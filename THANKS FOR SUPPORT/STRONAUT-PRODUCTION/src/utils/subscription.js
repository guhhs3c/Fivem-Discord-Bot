import { getDb } from '../database/db.js';
import { createErrorEmbed } from './embed.js';
import { config } from '../config/config.js';

// =======================================================
// SUBSCRIPTION (per-GUILD) — pengganti model donor per-user lama.
// "Subscription berlaku untuk seluruh member di server Discord ini."
// =======================================================

/**
 * Ambil status subscription guild saat ini.
 * Otomatis nonaktifin (soft) kalau sudah lewat expires_at.
 * Return: row (object) kalau aktif, atau null kalau belum/sudah expired.
 */
export function getGuildSubscriptionStatus(guildId) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM guild_subscriptions WHERE guild_id = ? AND is_active = 1`).get(guildId);
  if (!row) return null;

  if (row.expires_at) {
    const expiresMs = new Date(row.expires_at).getTime();
    if (Date.now() > expiresMs) {
      db.prepare(`UPDATE guild_subscriptions SET is_active = 0, updated_at = datetime('now') WHERE guild_id = ?`).run(guildId);
      return null;
    }
  }

  return row;
}

export function isGuildSubscribed(guildId) {
  return getGuildSubscriptionStatus(guildId) !== null;
}

/**
 * Aktifkan/perpanjang subscription sebuah guild.
 * Kalau masih aktif, durasi baru ditambahkan dari expires_at yang lama (menumpuk),
 * bukan dari sekarang — biar perpanjang sebelum habis gak rugi.
 * days = 0 (atau falsy) berarti lifetime (expires_at NULL).
 */
export function activateGuildSubscription(guildId, days, source) {
  const db = getDb();
  const current = db.prepare(`SELECT * FROM guild_subscriptions WHERE guild_id = ?`).get(guildId);

  let expiresAt = null;
  if (days && days > 0) {
    const base =
      current?.is_active && current?.expires_at && new Date(current.expires_at).getTime() > Date.now()
        ? new Date(current.expires_at).getTime()
        : Date.now();
    expiresAt = new Date(base + days * 86400000).toISOString();
  }

  db.prepare(`
    INSERT INTO guild_subscriptions (guild_id, is_active, activated_at, expires_at, source, updated_at)
    VALUES (?, 1, datetime('now'), ?, ?, datetime('now'))
    ON CONFLICT(guild_id) DO UPDATE SET
      is_active = 1,
      expires_at = excluded.expires_at,
      source = excluded.source,
      updated_at = datetime('now')
  `).run(guildId, expiresAt, source || null);

  return getGuildSubscriptionStatus(guildId);
}

/**
 * Guard buat command khusus langganan.
 * Pakai di command lain:
 *   const check = requireSubscription(message);
 *   if (!check.allowed) return message.reply({ embeds: [check.embed] });
 */
export function requireSubscription(message) {
  if (!message.guild) {
    return {
      allowed: false,
      embed: createErrorEmbed('Khusus di Server', 'Command ini cuma bisa dipakai di dalam server Discord, bukan DM.'),
    };
  }

  // Owner bot selalu boleh (buat testing/demo di server mana pun).
  if (message.author?.id && message.author.id === config.discord.ownerId) return { allowed: true };

  if (isGuildSubscribed(message.guild.id)) return { allowed: true };

  return {
    allowed: false,
    embed: createErrorEmbed(
      'Khusus Langganan 🔒',
      `Command ini hanya bisa dipakai server yang sudah **berlangganan**.\n\n` +
        `**Cara berlangganan:**\n` +
        `1️⃣ Ketik \`${config.bot.prefix}bayar\` di channel ini\n` +
        `2️⃣ Scan QRIS lalu klik **Saya Sudah Bayar**\n` +
        `3️⃣ Setelah Owner approve, premium aktif untuk seluruh server 🎉\n\n` +
        `Punya kode redeem? Klaim dengan \`${config.bot.prefix}redeem <kode>\`.\n` +
        `Cek status kapan aja dengan \`${config.bot.prefix}ceklangganan\`.`
    ),
  };
}

// =======================================================
// Tambahan: revoke, list, dan redeem aman (atomic + anti brute-force)
// =======================================================

export function revokeGuildSubscription(guildId) {
  const db = getDb();
  const res = db.prepare(
    `UPDATE guild_subscriptions SET is_active = 0, updated_at = datetime('now') WHERE guild_id = ? AND is_active = 1`
  ).run(guildId);
  return res.changes > 0;
}

/**
 * Tambah (days > 0) atau kurangi (days < 0) masa premium sebuah guild.
 * Dipakai panel admin website. Hasil <= sekarang otomatis mencabut premium.
 * Melempar Error('LIFETIME') kalau mencoba mengurangi premium lifetime
 * (pakai revokeGuildSubscription / `!premium revoke` untuk itu).
 */
export function adjustGuildSubscription(guildId, days, source) {
  if (days > 0) return activateGuildSubscription(guildId, days, source);

  const cur = getGuildSubscriptionStatus(guildId);
  if (!cur) return null;
  if (!cur.expires_at) throw new Error('LIFETIME');

  const t = new Date(cur.expires_at).getTime() + days * 86400000;
  if (!Number.isFinite(t) || t <= Date.now()) {
    revokeGuildSubscription(guildId);
    return null;
  }
  getDb().prepare(
    `UPDATE guild_subscriptions SET expires_at = ?, source = ?, updated_at = datetime('now') WHERE guild_id = ?`
  ).run(new Date(t).toISOString(), source || cur.source || null, guildId);
  return getGuildSubscriptionStatus(guildId);
}

export function listActiveSubscriptions() {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM guild_subscriptions WHERE is_active = 1 ORDER BY updated_at DESC`).all();
  // Buang yang sudah expired (sekalian rapikan lewat getGuildSubscriptionStatus).
  return rows.filter((r) => getGuildSubscriptionStatus(r.guild_id));
}

// Batasi percobaan kode salah: 5x gagal => dikunci 15 menit (per user).
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const failMap = new Map();

function lockRemainingMs(userId) {
  const f = failMap.get(userId);
  if (!f || !f.until) return 0;
  if (Date.now() >= f.until) {
    failMap.delete(userId);
    return 0;
  }
  return f.until - Date.now();
}

function registerFail(userId) {
  const f = failMap.get(userId) || { count: 0, until: 0 };
  f.count += 1;
  if (f.count >= MAX_FAILS) f.until = Date.now() + LOCK_MS;
  failMap.set(userId, f);
}

/**
 * Klaim kode redeem untuk sebuah guild.
 * Atomic: transaksi SQLite memastikan 1 kode cuma bisa dipakai 1x,
 * walau dua orang mengetik kode yang sama di detik yang sama.
 * Return: { ok: true, sub } atau { ok: false, reason, message }
 */
export function redeemCodeForGuild(guildId, userId, rawCode) {
  const wait = lockRemainingMs(userId);
  if (wait > 0) {
    return {
      ok: false,
      reason: 'locked',
      message: `Terlalu banyak kode salah. Coba lagi dalam **${Math.ceil(wait / 60000)} menit**.`,
    };
  }

  const code = String(rawCode || '').trim().toUpperCase();
  if (!/^STRO-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
    registerFail(userId);
    return { ok: false, reason: 'invalid', message: 'Format kode salah. Contoh: `STRO-AB12-CD34`.' };
  }

  const db = getDb();
  const tx = db.transaction(() => {
    const row = db.prepare(`SELECT * FROM redeem_codes WHERE code = ?`).get(code);
    if (!row) return { ok: false, reason: 'invalid', message: 'Kode redeem tidak ditemukan. Cek lagi penulisannya.' };

    const claimed = db.prepare(
      `UPDATE redeem_codes SET is_used = 1, used_by = ?, used_at = datetime('now') WHERE code = ? AND is_used = 0`
    ).run(userId, code);
    if (claimed.changes === 0) {
      return { ok: false, reason: 'used', message: 'Kode ini sudah pernah dipakai.' };
    }

    const sub = activateGuildSubscription(guildId, row.duration_days, `redeem:${code}`);
    return { ok: true, sub };
  });

  const result = tx();
  if (result.ok) failMap.delete(userId);
  else if (result.reason === 'invalid') registerFail(userId);
  return result;
}
