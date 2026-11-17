import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config/config.js';
import { createErrorEmbed, createSuccessEmbed, createWarningEmbed } from '../utils/embed.js';
import { getDb } from '../database/db.js';

function formatRupiah(n) {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

export default {
  customId: 'konfirmbayar',

  async execute(interaction) {
    const reference = interaction.customId.split('|')[1];
    if (!reference) {
      return interaction.reply({ embeds: [createErrorEmbed('Referensi Hilang', 'Tombol ini tidak valid.')], ephemeral: true });
    }

    const db = getDb();
    const row = db.prepare(`SELECT * FROM transactions WHERE reference = ?`).get(reference);

    if (!row) {
      return interaction.reply({ embeds: [createErrorEmbed('Transaksi Tidak Ditemukan', 'Data transaksi ini tidak ada di database.')], ephemeral: true });
    }

    if (row.status === 'PAID') {
      return interaction.reply({ embeds: [createSuccessEmbed('Sudah Aktif ✅', 'Transaksi ini sudah pernah di-approve sebelumnya.')], ephemeral: true });
    }

    if (row.status === 'REVIEW') {
      return interaction.reply({ embeds: [createWarningEmbed('Masih Diproses', 'Konfirmasi kamu sudah dikirim ke Owner, tinggal tunggu approve ya.')], ephemeral: true });
    }

    db.prepare(`UPDATE transactions SET status = 'REVIEW' WHERE reference = ?`).run(reference);

    await interaction.reply({
      embeds: [createSuccessEmbed(
        'Konfirmasi Terkirim',
        `Terima kasih! Konfirmasi pembayaran kamu sudah dikirim ke Owner.\nSubscription akan aktif otomatis setelah di-approve.`
      )],
      ephemeral: true,
    });

    const reviewEmbed = new EmbedBuilder()
      .setColor(config.colors.warning)
      .setTitle('🔔 Konfirmasi Pembayaran Baru')
      .setDescription(
        `**Ref:** \`${row.reference}\`\n` +
        `**Guild ID:** \`${row.guild_id}\`\n` +
        `**User:** <@${row.user_id}> (\`${row.user_id}\`)\n` +
        `**Nominal:** ${formatRupiah(row.amount)}\n` +
        `**Durasi:** ${row.duration_days} hari\n\n` +
        `Cek mutasi/riwayat pembayaran kamu, lalu approve atau reject di bawah.`
      )
      .setTimestamp();

    const reviewRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`adminapprove|${reference}`).setLabel('Approve').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`adminreject|${reference}`).setLabel('Reject').setEmoji('❌').setStyle(ButtonStyle.Danger),
    );

    try {
      const ownerId = config.discord.ownerId;
      if (ownerId) {
        const owner = await interaction.client.users.fetch(ownerId);
        await owner.send({ embeds: [reviewEmbed], components: [reviewRow] });
      }
    } catch (err) {
      console.error('[Konfirmbayar] Gagal DM owner:', err.message);
    }
  },
};
