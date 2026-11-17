import { randomInt } from 'crypto';
import { getDb } from '../database/db.js';
import { createErrorEmbed } from './embed.js';
import { config } from '../config/config.js';

// Karakter kode sengaja exclude 0/O/1/I biar gak ambigu pas donatur ngetik manual.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generate kode redeem unik (crypto-random), format: STRO-XXXX-XXXX
 */
export function generateRedeemCode() {
  const seg = () =>
    Array.from({ length: 4 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
  return `STRO-${seg()}-${seg()}`;
}

/**
 * Ambil status donatur user saat ini.
 * Otomatis nonaktifin (soft) kalau ternyata sudah lewat expires_at.
 * Return: row donor (object) kalau aktif, atau null kalau bukan donatur / sudah expired.
 */
export function getDonorStatus(userId) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM donors WHERE user_id = ? AND is_active = 1`).get(userId);
  if (!row) return null;

  if (row.expires_at) {
    const expiresMs = new Date(row.expires_at).getTime();
    if (Date.now() > expiresMs) {
      db.prepare(`UPDATE donors SET is_active = 0, updated_at = datetime('now') WHERE user_id = ?`).run(userId);
      return null;
    }
  }

  return row;
}

export function isDonor(userId) {
  return getDonorStatus(userId) !== null;
}

/**
 * Guard buat command khusus donatur.
 * Pakai di command lain:
 *   const check = requireDonor(message);
 *   if (!check.allowed) return message.reply({ embeds: [check.embed] });
 */
export function requireDonor(message) {
  if (isDonor(message.author.id)) return { allowed: true };

  return {
    allowed: false,
    embed: createErrorEmbed(
      'Khusus Donatur 🔒',
      `Command ini hanya bisa dipakai **Donatur**.\n\n` +
        `**Cara jadi donatur:**\n` +
        `1️⃣ Donasi lewat \`${config.bot.prefix}bayar\`\n` +
        `2️⃣ Kirim bukti transfer ke Owner/Support\n` +
        `3️⃣ Kamu bakal dapet kode redeem, klaim dengan \`${config.bot.prefix}redeem <kode>\`\n\n` +
        `Cek status kamu kapan aja dengan \`${config.bot.prefix}ceklangganan\`.`
    ),
  };
}
