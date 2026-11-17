import { EmbedBuilder } from 'discord.js';
import { config } from '../config/config.js';
import { createErrorEmbed, createSuccessEmbed } from '../utils/embed.js';
import { getDb } from '../database/db.js';
import { activateGuildSubscription } from '../utils/subscription.js';

export default {
  customId: 'adminapprove',

  async execute(interaction) {
    if (interaction.user.id !== config.discord.ownerId) {
      return interaction.reply({ embeds: [createErrorEmbed('Akses Ditolak', 'Cuma Owner bot yang bisa approve pembayaran.')], ephemeral: true });
    }

    const reference = interaction.customId.split('|')[1];
    const db = getDb();
    const row = db.prepare(`SELECT * FROM transactions WHERE reference = ?`).get(reference);

    if (!row) {
      return interaction.reply({ embeds: [createErrorEmbed('Transaksi Tidak Ditemukan', 'Data transaksi ini tidak ada di database.')], ephemeral: true });
    }

    if (row.status === 'PAID') {
      return interaction.reply({ embeds: [createSuccessEmbed('Sudah Diapprove', 'Transaksi ini sudah pernah di-approve sebelumnya.')], ephemeral: true });
    }

    db.prepare(`UPDATE transactions SET status = 'PAID', paid_at = datetime('now') WHERE reference = ?`).run(reference);
    const sub = activateGuildSubscription(row.guild_id, row.duration_days, `manual:${row.reference}`);

    await interaction.update({
      embeds: [createSuccessEmbed('Disetujui ✅', `Pembayaran \`${row.reference}\` sudah di-approve dan subscription sudah aktif.`)],
      components: [],
    });

    const durationText = sub.expires_at
      ? `sampai <t:${Math.floor(new Date(sub.expires_at).getTime() / 1000)}:F>`
      : '**selamanya (Lifetime)** ♾️';

    try {
      const channel = await interaction.client.channels.fetch(row.channel_id);
      const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('🎉 Pembayaran Terverifikasi!')
        .setDescription(
          `<@${row.user_id}> Pembayaran kamu sudah dikonfirmasi Owner!\n\n` +
          `Subscription server ini sekarang **aktif** ${durationText}.\n\n` +
          `Command khusus langganan sudah bisa dipakai: \`${config.bot.prefix}setmonitor\`, \`${config.bot.prefix}settextstatusall\`, \`${config.bot.prefix}loop\`, \`${config.bot.prefix}cfxfinder\`.`
        )
        .setTimestamp();
      await channel.send({ content: `<@${row.user_id}>`, embeds: [embed] });
    } catch (err) {
      console.error('[AdminApprove] Gagal kirim notif ke channel:', err.message);
    }
  },
};
