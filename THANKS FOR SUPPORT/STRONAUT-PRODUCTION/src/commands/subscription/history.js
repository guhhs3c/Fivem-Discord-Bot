import { createWarningEmbed, createSuccessEmbed, createErrorEmbed } from '../../utils/embed.js';
import { getDb } from '../../database/db.js';
import { config } from '../../config/config.js';

export default {
  name: 'history',
  aliases: ['riwayat'],
  description: 'Riwayat transaksi pembayaran server ini',
  usage: `${config.bot.prefix}history`,
  example: `${config.bot.prefix}history`,
  cooldown: 5,

  async execute(message) {
    if (!message.guild) {
      return message.reply({
        embeds: [createErrorEmbed('Khusus di Server', 'Command ini cuma bisa dipakai di dalam server Discord, bukan DM.')],
      });
    }

    const rows = getDb()
      .prepare(`SELECT * FROM transactions WHERE guild_id = ? ORDER BY created_at DESC LIMIT 10`)
      .all(message.guild.id);

    if (!rows.length) {
      return message.reply({
        embeds: [createWarningEmbed('Belum Ada Riwayat', `Server ini belum pernah bertransaksi.\nKetik \`${config.bot.prefix}bayar\` untuk berlangganan.`)],
      });
    }

    const statusEmoji = { PAID: '✅', UNPAID: '⏳', EXPIRED: '⌛', FAILED: '❌', REFUND: '↩️' };
    const lines = rows.map((r) => {
      const emoji = statusEmoji[r.status] || '❔';
      const date = new Date(r.created_at).toLocaleString('id-ID');
      return `${emoji} \`${r.reference}\` — Rp ${r.amount.toLocaleString('id-ID')} (${r.duration_days} hari) — ${r.status} — ${date}`;
    });

    await message.reply({
      embeds: [createSuccessEmbed('Riwayat Transaksi', lines.join('\n'))],
    });
  },
};
