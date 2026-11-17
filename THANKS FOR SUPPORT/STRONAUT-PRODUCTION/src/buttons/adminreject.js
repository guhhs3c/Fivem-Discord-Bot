import { createErrorEmbed, createSuccessEmbed } from '../utils/embed.js';
import { config } from '../config/config.js';
import { getDb } from '../database/db.js';

export default {
  customId: 'adminreject',

  async execute(interaction) {
    if (interaction.user.id !== config.discord.ownerId) {
      return interaction.reply({ embeds: [createErrorEmbed('Akses Ditolak', 'Cuma Owner bot yang bisa reject pembayaran.')], ephemeral: true });
    }

    const reference = interaction.customId.split('|')[1];
    const db = getDb();
    const row = db.prepare(`SELECT * FROM transactions WHERE reference = ?`).get(reference);

    if (!row) {
      return interaction.reply({ embeds: [createErrorEmbed('Transaksi Tidak Ditemukan', 'Data transaksi ini tidak ada di database.')], ephemeral: true });
    }

    db.prepare(`UPDATE transactions SET status = 'FAILED' WHERE reference = ?`).run(reference);

    await interaction.update({
      embeds: [createSuccessEmbed('Ditolak', `Pembayaran \`${row.reference}\` sudah ditandai gagal/ditolak.`)],
      components: [],
    });

    try {
      const channel = await interaction.client.channels.fetch(row.channel_id);
      await channel.send({
        content: `<@${row.user_id}>`,
        embeds: [createErrorEmbed('Pembayaran Ditolak', `Konfirmasi pembayaran kamu (Ref: \`${row.reference}\`) ditolak Owner.\nKalau ini kesalahan, hubungi Owner atau ketik \`${config.bot.prefix}bayar\` lagi untuk buat transaksi baru.`)],
      });
    } catch (err) {
      console.error('[AdminReject] Gagal kirim notif ke channel:', err.message);
    }
  },
};
