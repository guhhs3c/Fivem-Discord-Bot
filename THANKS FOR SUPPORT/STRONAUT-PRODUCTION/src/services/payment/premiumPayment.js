import { randomBytes } from 'crypto';
import { getDb } from '../../database/db.js';
import { config } from '../../config/config.js';
import { activateGuildSubscription } from '../../utils/subscription.js';
import { createSuccessEmbed } from '../../utils/embed.js';
import { getDefaultPlan, PREMIUM_FEATURES } from '../../utils/premiumPlans.js';
import { createQrisTransaction, getTransactionStatus, paymentLink, cancelTransaction } from './pakasir.js';

// =======================================================
// Pembayaran premium OTOMATIS — dipakai bersama oleh BOT (!bayar) dan WEBSITE.
//  1. !bayar / halaman beli web -> createOrder() -> QRIS dinamis dari Pakasir
//  2. Poller (bot)              -> cek order UNPAID tiap beberapa detik
//  3. PAID                      -> guild_subscriptions aktif (atomic, tidak bisa dobel)
// Kedua jalur memakai SATU tabel (premium_orders), SATU poller, dan SATU fungsi
// aktivasi (activateGuildSubscription) — jadi premium yang dibeli lewat web
// langsung terbaca oleh bot, dan sebaliknya.
// Pakai polling (bukan hanya webhook) supaya tetap aman kalau bot sempat mati:
// order yang dibayar saat bot offline otomatis diaktifkan begitu bot hidup lagi.
// =======================================================

const POLL_INTERVAL_MS = 15 * 1000;
const EXPIRE_GRACE_MS = 5 * 60 * 1000; // toleransi setelah QR kedaluwarsa sebelum ditandai EXPIRED
const MIN_GAP_MS = 4500; // Pakasir: 1 request / 4 detik per transaksi
const lastCheck = new Map();
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // order lebih tua dari ini tidak dicek lagi
const MAX_PER_CYCLE = 20;

let tableReady = false;

/**
 * Pastikan skema premium siap + migrasi data lama dari versi web terpisah:
 *  - tabel `premium_orders` versi web lama (kolom order_id) -> diganti nama & datanya disalin
 *  - tabel `premium_subscriptions` versi web lama -> digabung ke `guild_subscriptions`
 * Aman dipanggil berkali-kali.
 */
export function ensurePremiumSchema() {
  if (tableReady) return;
  const db = getDb();
  const cols = () => db.prepare(`PRAGMA table_info(premium_orders)`).all().map((c) => c.name);

  // 1) Skema web lama bentrok nama dengan skema bot -> pindahkan dulu.
  let renamedLegacy = false;
  let c = cols();
  if (c.includes('order_id') && !c.includes('merchant_ref')) {
    db.exec(`ALTER TABLE premium_orders RENAME TO premium_orders_legacy_web`);
    renamedLegacy = true;
  }

  // 2) Tabel final (skema bot + kolom tambahan untuk pembelian lewat web).
  db.exec(`
    CREATE TABLE IF NOT EXISTS premium_orders (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_ref  TEXT NOT NULL UNIQUE,
      reference     TEXT NOT NULL,
      guild_id      TEXT NOT NULL,
      channel_id    TEXT,
      user_id       TEXT NOT NULL,
      amount        INTEGER NOT NULL,
      total_pay     INTEGER,
      duration_days INTEGER NOT NULL,
      qr_string     TEXT,
      checkout_url  TEXT,
      status        TEXT NOT NULL DEFAULT 'UNPAID',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at    TEXT NOT NULL,
      paid_at       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_premium_orders_status ON premium_orders(status);
  `);

  // 3) Kolom tambahan (untuk tabel bot lama yang belum punya).
  c = cols();
  for (const [name, ddl] of [
    ['plan_id', 'TEXT'],
    ['plan_name', 'TEXT'],
    ['guild_name', 'TEXT'],
    ['contact', 'TEXT'],
    ['source', "TEXT DEFAULT 'discord'"],
  ]) {
    if (!c.includes(name)) db.exec(`ALTER TABLE premium_orders ADD COLUMN ${name} ${ddl}`);
  }

  // 4) Salin riwayat order web lama (hanya sekali, tepat setelah rename).
  if (renamedLegacy) {
    try {
      const n = db.prepare(`
        INSERT OR IGNORE INTO premium_orders
          (merchant_ref, reference, guild_id, guild_name, user_id, amount, total_pay, duration_days,
           qr_string, status, expires_at, paid_at, created_at, plan_id, plan_name, contact, source)
        SELECT order_id, order_id, guild_id, guild_name, 'web', amount, total, days,
               qr_string, CASE status WHEN 'paid' THEN 'PAID' ELSE 'EXPIRED' END,
               COALESCE(expired_at, created_at, datetime('now')), paid_at, created_at, plan_id, plan_name, contact, 'web'
        FROM premium_orders_legacy_web
      `).run().changes;
      console.log(`[Premium] Migrasi: ${n} order web lama dipindah ke premium_orders.`);
    } catch (e) {
      console.error('[Premium] Gagal migrasi order web lama:', e.message);
    }
  }

  // 5) Gabungkan langganan web lama ke tabel yang dibaca bot (guild_subscriptions).
  const hasLegacySubs = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='premium_subscriptions'`).get();
  if (hasLegacySubs) {
    try {
      const n = db.prepare(`
        INSERT INTO guild_subscriptions (guild_id, is_active, activated_at, expires_at, source, updated_at)
        SELECT guild_id, 1, datetime('now'), expires_at, 'web-legacy', datetime('now')
        FROM premium_subscriptions WHERE expires_at > ?
        ON CONFLICT(guild_id) DO UPDATE SET
          is_active = 1, expires_at = excluded.expires_at, source = excluded.source, updated_at = datetime('now')
        WHERE guild_subscriptions.is_active = 0
           OR (guild_subscriptions.expires_at IS NOT NULL AND excluded.expires_at > guild_subscriptions.expires_at)
      `).run(new Date().toISOString()).changes;
      db.exec(`ALTER TABLE premium_subscriptions RENAME TO premium_subscriptions_legacy_web`);
      console.log(`[Premium] Migrasi: ${n} langganan web lama digabung ke guild_subscriptions.`);
    } catch (e) {
      console.error('[Premium] Gagal migrasi langganan web lama:', e.message);
    }
  }

  tableReady = true;
}

export function getOrder(merchantRef) {
  ensurePremiumSchema();
  return getDb().prepare(`SELECT * FROM premium_orders WHERE merchant_ref = ?`).get(merchantRef) || null;
}

/**
 * Buat order baru, atau pakai ulang order UNPAID yang sama (server + paket + pembeli)
 * dan belum kedaluwarsa, supaya spam tidak menumpuk transaksi di Pakasir.
 *
 * plan   : objek paket dari premiumPlans.js (default: paket pertama)
 * source : 'discord' (!bayar) atau 'web' (halaman beli)
 */
export async function createOrder({
  guildId, channelId = null, userId, username,
  plan = null, source = 'discord', contact = null, guildName = null,
}) {
  ensurePremiumSchema();
  const db = getDb();
  const p = plan || getDefaultPlan();
  const price = p.price;
  const durationDays = p.days;

  const existing = db.prepare(`
    SELECT * FROM premium_orders
    WHERE guild_id = ? AND user_id = ? AND status = 'UNPAID' AND expires_at > ?
      AND amount = ? AND duration_days = ?
    ORDER BY id DESC LIMIT 1
  `).get(guildId, userId, new Date(Date.now() + 60000).toISOString(), price, durationDays);
  if (existing && existing.qr_string) return { order: existing, reused: true };

  const merchantRef = `STRO${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString('hex').toUpperCase()}`;

  const data = await createQrisTransaction({ orderId: merchantRef, amount: price });
  if (!data?.txn_id || !data?.qr_string) throw new Error('Pakasir: respons create tidak lengkap');

  let expiresAt = new Date(data.expired_at);
  if (Number.isNaN(expiresAt.getTime())) expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  db.prepare(`
    INSERT INTO premium_orders
      (merchant_ref, reference, guild_id, channel_id, user_id, amount, total_pay, duration_days, qr_string,
       checkout_url, status, expires_at, plan_id, plan_name, guild_name, contact, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, ?, ?, ?, ?, ?)
  `).run(
    merchantRef,
    data.txn_id,
    guildId,
    channelId,
    userId,
    price,
    Number(data.total_payment) || price,
    durationDays,
    data.qr_string,
    paymentLink(data.txn_id),
    expiresAt.toISOString(),
    p.id,
    p.name,
    guildName,
    contact,
    source,
  );

  return { order: getOrder(merchantRef), reused: false };
}

/**
 * Tandai order lunas + aktifkan premium dalam SATU transaksi.
 * Hanya satu pemanggil yang menang (UPDATE ... WHERE status = 'UNPAID'),
 * jadi poller, webhook, tombol "Cek Pembayaran", dan halaman web tidak bisa
 * mengaktifkan dua kali. Return subscription row kalau berhasil, null kalau sudah diproses.
 */
function markPaidAndActivate(order) {
  const db = getDb();
  return db.transaction(() => {
    const res = db.prepare(
      `UPDATE premium_orders SET status = 'PAID', paid_at = datetime('now') WHERE id = ? AND status = 'UNPAID'`
    ).run(order.id);
    if (res.changes === 0) return null;
    return activateGuildSubscription(order.guild_id, order.duration_days, `pakasir:${order.reference}`);
  })();
}

async function notifyPaid(client, order, sub) {
  const until = sub?.expires_at
    ? `sampai <t:${Math.floor(new Date(sub.expires_at).getTime() / 1000)}:F>`
    : '**Lifetime** ♾️';
  const p = config.bot.prefix;
  const viaWeb = order.source === 'web';
  const guild = client.guilds.cache.get(order.guild_id);
  const guildName = order.guild_name || guild?.name || order.guild_id;
  const cmds = [...new Set(PREMIUM_FEATURES.flatMap((f) => f.cmds))].map((c) => `\`${p}${c}\``).join(', ');

  const embed = createSuccessEmbed(
    'Pembayaran Diterima — Premium Aktif! 🎉',
    `Server **${guildName}** sekarang premium ${until}${viaWeb ? ' (dibeli lewat website)' : ''}.\n\n` +
    `Seluruh member bisa pakai fitur premium: ${cmds}.\n` +
    `Terima kasih sudah mendukung STRONAUT! 🙏`
  );

  // Pembelian lewat !bayar -> balas di channel asal. Pembelian web -> channel sistem server.
  let delivered = false;
  if (order.channel_id) {
    try {
      const ch = await client.channels.fetch(order.channel_id);
      await ch.send({ content: order.user_id && order.user_id !== 'web' ? `<@${order.user_id}>` : undefined, embeds: [embed] });
      delivered = true;
    } catch (err) {
      console.error('[Payment] Gagal kirim notifikasi channel:', err.message);
    }
  }
  if (!delivered && guild) {
    try {
      const ch = guild.systemChannel;
      if (ch && ch.permissionsFor(guild.members.me)?.has(['ViewChannel', 'SendMessages'])) {
        await ch.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error('[Payment] Gagal kirim notifikasi ke channel sistem:', err.message);
    }
  }

  // Info singkat ke Owner (tanpa perlu approve — hanya pemberitahuan).
  if (config.discord.ownerId) {
    try {
      const owner = await client.users.fetch(config.discord.ownerId);
      await owner.send(
        `💰 Premium otomatis aktif (${viaWeb ? '🌐 website' : '💬 Discord'})\n` +
        `Server: **${guildName}** (\`${order.guild_id}\`)\n` +
        (viaWeb
          ? `Paket: ${order.plan_name || order.duration_days + ' hari'}${order.contact ? `\nKontak: ${order.contact}` : ''}\n`
          : `User: <@${order.user_id}>\n`) +
        `Nominal: Rp ${order.amount.toLocaleString('id-ID')}\nRef: \`${order.reference}\``
      );
    } catch {}
  }
}

/**
 * Cek satu order ke Pakasir dan proses hasilnya.
 * Return status akhir: 'PAID' | 'UNPAID' | 'EXPIRED' | 'CANCELED' | 'FAILED' | 'NOT_FOUND'
 * force = true melewati pembatas 4,5 detik (dipakai webhook Pakasir).
 */
export async function checkOrder(client, merchantRef, { force = false } = {}) {
  ensurePremiumSchema();
  const db = getDb();
  const order = db.prepare(`SELECT * FROM premium_orders WHERE merchant_ref = ?`).get(merchantRef);
  if (!order) return { status: 'NOT_FOUND' };
  if (order.status !== 'UNPAID') return { status: order.status, order };

  // Hormati batas Pakasir (1 req / 4 dtk per transaksi): kalau baru dicek, anggap belum berubah.
  const last = lastCheck.get(order.reference) || 0;
  if (!force && Date.now() - last < MIN_GAP_MS) return { status: 'UNPAID', order };
  lastCheck.set(order.reference, Date.now());

  const detail = await getTransactionStatus(order.reference);

  // Pastikan detail memang milik order ini.
  if (detail.order_id && detail.order_id !== order.merchant_ref) {
    console.error(`[Payment] order_id tidak cocok untuk ${order.reference}, diabaikan.`);
    return { status: 'UNPAID', order };
  }

  if (detail.status === 'completed') {
    lastCheck.delete(order.reference);
    const sub = markPaidAndActivate(order);
    if (sub) {
      console.log(`[Payment] LUNAS ${order.merchant_ref} guild=${order.guild_id} via=${order.source || 'discord'}`);
      // Premium sudah aktif di titik ini; gagal kirim notifikasi tidak boleh membuat pembayaran tampak gagal.
      try { await notifyPaid(client, order, sub); }
      catch (err) { console.error('[Payment] Notifikasi lunas gagal:', err.message); }
    }
    return { status: 'PAID', order: getOrder(merchantRef), sub };
  }

  const pastExpiry = Date.now() > new Date(order.expires_at).getTime() + EXPIRE_GRACE_MS;
  if (detail.status === 'canceled' || pastExpiry) {
    lastCheck.delete(order.reference);
    db.prepare(`UPDATE premium_orders SET status = 'EXPIRED' WHERE id = ? AND status = 'UNPAID'`).run(order.id);
    return { status: 'EXPIRED', order: getOrder(merchantRef) };
  }

  return { status: 'UNPAID', order };
}

/**
 * Batalkan order UNPAID. Order baru ditandai CANCELED kalau Pakasir berhasil
 * membatalkannya; kalau gagal order dibiarkan UNPAID agar pembayaran yang
 * tetap masuk tidak hilang (poller tetap akan mengaktifkannya).
 */
export async function cancelOrder(merchantRef) {
  const order = getOrder(merchantRef);
  if (!order || order.status !== 'UNPAID') return { ok: true, canceled: false };
  try {
    await cancelTransaction({ orderId: order.merchant_ref, amount: order.amount });
  } catch (err) {
    console.warn(`[Payment] Gagal membatalkan ${merchantRef} di Pakasir:`, err.message);
    return { ok: true, canceled: false };
  }
  getDb().prepare(`UPDATE premium_orders SET status = 'CANCELED' WHERE id = ? AND status = 'UNPAID'`).run(order.id);
  return { ok: true, canceled: true };
}

async function pollOnce(client) {
  ensurePremiumSchema();
  const since = new Date(Date.now() - MAX_AGE_MS).toISOString().replace('T', ' ').slice(0, 19);
  const pending = getDb().prepare(
    `SELECT merchant_ref FROM premium_orders WHERE status = 'UNPAID' AND created_at >= ? ORDER BY id LIMIT ?`
  ).all(since, MAX_PER_CYCLE);

  for (const { merchant_ref } of pending) {
    try {
      await checkOrder(client, merchant_ref);
    } catch (err) {
      console.error(`[Payment] Gagal cek ${merchant_ref}:`, err.message);
    }
    await new Promise((r) => setTimeout(r, 600)); // batas Pakasir 2 req/detik
  }
}

export function startPaymentPoller(client) {
  ensurePremiumSchema();
  let running = false;
  const tick = async () => {
    if (running) return; // jangan tumpang-tindih kalau API lambat
    running = true;
    try { await pollOnce(client); } finally { running = false; }
  };
  setTimeout(tick, 5000); // langsung susul order yang dibayar saat bot offline
  setInterval(tick, POLL_INTERVAL_MS);
  console.log(`[Payment] Auto-premium aktif untuk Discord & website (cek tiap ${POLL_INTERVAL_MS / 1000}s)`);
}
