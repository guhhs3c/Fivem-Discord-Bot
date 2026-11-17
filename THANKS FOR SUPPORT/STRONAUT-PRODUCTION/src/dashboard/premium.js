// ============================================================
// STRONAUT — Premium di website (QRIS via Pakasir)
//
// Website TIDAK punya sistem premium sendiri. Semuanya memakai komponen bot:
//   • paket & fitur ........ utils/premiumPlans.js
//   • order & pembayaran ... services/payment/premiumPayment.js (tabel premium_orders)
//   • status premium ....... utils/subscription.js (tabel guild_subscriptions)
// Jadi premium yang dibeli / di-redeem / diberikan lewat web langsung aktif di bot,
// dan premium dari !bayar / !redeem / !premium give langsung terlihat di web.
//
// ENV (sama dengan bot):
//   PAKASIR_SLUG (alias PAKASIR_PROJECT), PAKASIR_API_KEY
//   PAKASIR_WEBHOOK_SECRET  (opsional) wajib dikirim Pakasir via ?secret=... / header X-Secret
//   PREMIUM_PLANS           (opsional) JSON paket, lihat env.lite.example
//
// Webhook URL di Pakasir:  https://DOMAIN-ANDA/api/premium/webhook?secret=NILAI_SECRET
// ============================================================
import crypto from 'crypto';
import { getDb } from '../database/db.js';
import { isPaymentConfigured, pakasirConfig } from '../services/payment/pakasir.js';
import {
  ensurePremiumSchema, createOrder, checkOrder, cancelOrder, getOrder,
} from '../services/payment/premiumPayment.js';
import {
  getGuildSubscriptionStatus, adjustGuildSubscription, redeemCodeForGuild,
} from '../utils/subscription.js';
import { getPlans, getPlan, rupiah, PREMIUM_FEATURES } from '../utils/premiumPlans.js';
import { config } from '../config/config.js';

let QRCode = null;
try {
  QRCode = (await import('qrcode')).default;
} catch {
  console.warn('[Premium] Paket "qrcode" belum terpasang — jalankan: npm install');
}

const isSnowflake = (s) => /^\d{15,22}$/.test(s);
const ORDER_ID_RE = /^STRO[A-Z0-9]{6,40}$/;
const STATUS_UI = { UNPAID: 'pending', PAID: 'paid', EXPIRED: 'expired', CANCELED: 'canceled' };

/** Dipakai kode lain: apakah guild ini premium sekarang? (sama persis dengan yang dibaca bot) */
export function isGuildPremium(guildId) {
  return getGuildSubscriptionStatus(String(guildId)) !== null;
}

export function registerPremium(app, { getDb: _unused, client }) {
  try { ensurePremiumSchema(); }
  catch (e) { console.error('[Premium] Gagal menyiapkan skema:', e.message); return; }

  // ---------- util ----------
  const buckets = new Map();
  function rateLimit(key, max, windowMs) {
    const now = Date.now();
    const b = (buckets.get(key) || []).filter((t) => now - t < windowMs);
    if (b.length >= max) return false;
    b.push(now); buckets.set(key, b); return true;
  }
  setInterval(() => buckets.clear(), 10 * 60 * 1000).unref();

  const publicOrder = (o) => ({
    order_id: o.merchant_ref,
    status: STATUS_UI[o.status] || 'pending',
    plan_name: o.plan_name || `Premium ${o.duration_days} Hari`,
    days: o.duration_days,
    guild_id: o.guild_id,
    guild_name: o.guild_name || client?.guilds?.cache?.get(o.guild_id)?.name || null,
    amount: o.amount,
    fee: Math.max(0, (o.total_pay || o.amount) - o.amount),
    total: o.total_pay || o.amount,
    expired_at: o.expires_at,
    paid_at: o.paid_at,
  });

  const qrFor = async (qr) => (QRCode && qr ? QRCode.toDataURL(qr, { margin: 1, width: 360 }) : null);

  // ---------- PUBLIC ----------
  app.get('/api/premium/plans', (req, res) => {
    res.json({
      enabled: isPaymentConfigured(),
      plans: getPlans().map((p) => ({ ...p, priceLabel: rupiah(p.price) })),
      features: PREMIUM_FEATURES.map((f) => ({
        commands: f.cmds.map((c) => `${config.bot.prefix}${c}`),
        desc: f.desc,
      })),
    });
  });

  // cek nama server dari ID (agar pembeli yakin tidak salah server) + status premium saat ini
  app.get('/api/premium/guild/:id', (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!isSnowflake(id)) return res.status(400).json({ ok: false, error: 'Server ID tidak valid' });
    if (!rateLimit('g:' + req.ip, 30, 60000)) return res.status(429).json({ ok: false, error: 'Terlalu banyak percobaan' });
    const g = client?.guilds?.cache?.get(id);
    if (!g) return res.status(404).json({ ok: false, error: 'Bot STRONAUT belum ada di server ini. Invite bot dulu, lalu coba lagi.' });
    const sub = getGuildSubscriptionStatus(id);
    res.json({
      ok: true, id, name: g.name,
      icon: g.iconURL?.({ size: 128 }) || null,
      members: g.memberCount ?? null,
      premium: !!sub,
      lifetime: !!sub && !sub.expires_at,
      premiumUntil: sub?.expires_at || null,
    });
  });

  app.post('/api/premium/checkout', async (req, res) => {
    try {
      if (!isPaymentConfigured()) return res.status(503).json({ ok: false, error: 'Pembayaran belum dikonfigurasi admin.' });
      if (!rateLimit('c:' + req.ip, 8, 10 * 60000)) return res.status(429).json({ ok: false, error: 'Terlalu banyak percobaan, coba lagi nanti.' });

      const guildId = String(req.body?.guild_id || '').trim();
      const plan = getPlan(req.body?.plan_id);
      const contact = String(req.body?.contact || '').trim().slice(0, 100) || null;
      if (!isSnowflake(guildId)) return res.status(400).json({ ok: false, error: 'Server ID tidak valid' });
      if (!plan) return res.status(400).json({ ok: false, error: 'Paket tidak ditemukan' });

      const g = client?.guilds?.cache?.get(guildId);
      if (!g) return res.status(404).json({ ok: false, error: 'Bot STRONAUT belum ada di server ini.' });

      const { order } = await createOrder({
        guildId, userId: 'web', plan, source: 'web', contact, guildName: g.name,
      });
      res.json({ ok: true, order: publicOrder(order), qr: await qrFor(order.qr_string) });
    } catch (e) {
      console.error('[Premium] checkout gagal:', e.message);
      res.status(502).json({ ok: false, error: 'Gagal membuat pembayaran. Coba lagi sebentar.' });
    }
  });

  // polling status dari halaman beli (order_id acak = bertindak sebagai token)
  app.get('/api/premium/order/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '');
      if (!ORDER_ID_RE.test(id)) return res.status(400).json({ ok: false, error: 'Order tidak valid' });
      if (!rateLimit('o:' + req.ip, 90, 60000)) return res.status(429).json({ ok: false, error: 'Terlalu cepat' });
      if (!getOrder(id)) return res.status(404).json({ ok: false, error: 'Order tidak ditemukan' });

      try { await checkOrder(client, id); }
      catch (e) { console.warn('[Premium] cek status gagal:', e.message); }

      res.json({ ok: true, order: publicOrder(getOrder(id)) });
    } catch {
      res.status(500).json({ ok: false, error: 'Gagal membaca order' });
    }
  });

  app.post('/api/premium/order/:id/cancel', async (req, res) => {
    try {
      const id = String(req.params.id || '');
      if (!ORDER_ID_RE.test(id)) return res.status(400).json({ ok: false });
      const r = await cancelOrder(id);
      res.json({ ok: true, canceled: r.canceled });
    } catch { res.status(500).json({ ok: false }); }
  });

  // Klaim kode redeem (dibuat lewat /gencode di bot) langsung dari website.
  app.post('/api/premium/redeem', (req, res) => {
    try {
      if (!rateLimit('r:' + req.ip, 10, 10 * 60000)) return res.status(429).json({ ok: false, error: 'Terlalu banyak percobaan, coba lagi nanti.' });
      const guildId = String(req.body?.guild_id || '').trim();
      const code = String(req.body?.code || '').trim();
      if (!isSnowflake(guildId)) return res.status(400).json({ ok: false, error: 'Server ID tidak valid' });
      if (!code) return res.status(400).json({ ok: false, error: 'Kode redeem wajib diisi' });
      const g = client?.guilds?.cache?.get(guildId);
      if (!g) return res.status(404).json({ ok: false, error: 'Bot STRONAUT belum ada di server ini.' });

      // kunci anti brute-force bot (5x salah => 15 menit) dipakai juga di sini, per IP
      const r = redeemCodeForGuild(guildId, 'web:' + req.ip, code);
      if (!r.ok) return res.status(400).json({ ok: false, error: String(r.message || 'Redeem gagal').replace(/\*\*/g, '').replace(/`/g, '') });

      console.log(`[Premium] REDEEM via web guild=${guildId}`);
      res.json({ ok: true, guild_name: g.name, lifetime: !r.sub?.expires_at, expires_at: r.sub?.expires_at || null });
    } catch (e) {
      console.error('[Premium] redeem gagal:', e.message);
      res.status(500).json({ ok: false, error: 'Gagal memproses kode' });
    }
  });

  // ---------- WEBHOOK (dipanggil Pakasir) ----------
  app.post('/api/premium/webhook', async (req, res) => {
    try {
      const secret = process.env.PAKASIR_WEBHOOK_SECRET || '';
      if (secret) {
        const got = String(req.get('x-secret') || req.query.secret || '');
        const a = Buffer.from(got), b = Buffer.from(secret);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ ok: false });
      }
      const p = req.body || {};
      const orderId = String(p.order_id || '');
      const slug = pakasirConfig().slug;
      if (!orderId || (p.project && slug && p.project !== slug)) return res.status(400).json({ ok: false });

      const order = getOrder(orderId);
      if (!order || Number(p.amount) !== order.amount) return res.status(404).json({ ok: false });

      // konfirmasi ulang ke Pakasir — jangan percaya webhook begitu saja
      if (order.status === 'UNPAID') await checkOrder(client, orderId, { force: true });
      res.json({ ok: true });
    } catch (e) {
      console.error('[Premium] webhook error:', e.message);
      res.status(500).json({ ok: false });
    }
  });

  // ---------- ADMIN (dipasang setelah requireAdmin oleh pemanggil) ----------
  return function registerPremiumAdmin() {
    app.get('/api/premium/orders', (req, res) => {
      const db = getDb();
      const nameOf = (id) => client?.guilds?.cache?.get(id)?.name || null;

      const orders = db.prepare(`
        SELECT merchant_ref, guild_id, guild_name, plan_name, duration_days, amount, total_pay,
               status, contact, source, paid_at, created_at
        FROM premium_orders ORDER BY id DESC LIMIT 300
      `).all().map((o) => ({
        order_id: o.merchant_ref,
        guild_id: o.guild_id,
        guild_name: o.guild_name || nameOf(o.guild_id),
        plan_name: o.plan_name || `Premium ${o.duration_days} Hari`,
        days: o.duration_days,
        amount: o.amount,
        total: o.total_pay,
        status: STATUS_UI[o.status] || 'pending',
        contact: o.contact,
        source: o.source || 'discord',
        paid_at: o.paid_at,
        created_at: o.created_at,
      }));

      const now = Date.now();
      const subs = db.prepare(`
        SELECT guild_id, is_active, expires_at, source FROM guild_subscriptions ORDER BY updated_at DESC LIMIT 300
      `).all().map((s) => ({
        guild_id: s.guild_id,
        guild_name: nameOf(s.guild_id),
        expires_at: s.expires_at,                       // null = lifetime
        lifetime: !s.expires_at,
        source: String(s.source || '').split(':')[0] || null,   // tanpa detail (kode redeem dsb.)
        active: !!s.is_active && (!s.expires_at || new Date(s.expires_at).getTime() > now),
      }));

      // pendapatan = order QRIS lunas (bot + web) + transaksi manual yang di-approve owner
      const a = db.prepare(`SELECT COALESCE(SUM(amount),0) AS r, COUNT(*) AS n FROM premium_orders WHERE status='PAID'`).get();
      const m = db.prepare(`SELECT COALESCE(SUM(amount),0) AS r, COUNT(*) AS n FROM transactions WHERE status='PAID'`).get();

      res.json({
        orders, subs,
        revenue: a.r + m.r,
        paid: a.n + m.n,
        enabled: isPaymentConfigured(),
      });
    });

    // tambah / kurangi masa premium manual (hari negatif = kurangi, sampai habis = cabut)
    app.post('/api/premium/grant', (req, res) => {
      const guildId = String(req.body?.guild_id || '').trim();
      const days = Number(req.body?.days);
      if (!isSnowflake(guildId) || !Number.isFinite(days) || days === 0 || Math.abs(days) > 3650) {
        return res.status(400).json({ ok: false, error: 'guild_id / days tidak valid' });
      }
      try {
        const sub = adjustGuildSubscription(guildId, Math.trunc(days), `admin:${req.admin?.username || 'web'}`);
        res.json({ ok: true, active: !!sub, expires_at: sub?.expires_at || null });
      } catch (e) {
        if (e.message === 'LIFETIME') {
          return res.status(400).json({ ok: false, error: 'Server ini Lifetime. Cabut dengan !premium revoke <guild_id>.' });
        }
        console.error('[Premium] grant gagal:', e.message);
        res.status(500).json({ ok: false, error: 'Gagal memperbarui premium' });
      }
    });
  };
}
