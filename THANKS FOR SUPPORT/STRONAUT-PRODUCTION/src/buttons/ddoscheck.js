import { runDdosCheck } from '../services/monitor/ddosDetectionService.js';
import { createDdosCheckEmbed, createErrorEmbed, createLoadingEmbed } from '../utils/embed.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  customId: 'ddoscheck',
  premium: true,

  async execute(interaction) {
    const server = interaction.customId.split('|').slice(1).join('|');
    if (!server) return interaction.reply({ content: '❌ Data tombol tidak valid.', ephemeral: true });

    await interaction.deferUpdate();
    await interaction.editReply({ embeds: [createLoadingEmbed(`Mengecek ulang **${server}**, mohon tunggu...`)], components: [] });

    try {
      // runDdosCheck punya cooldown per-target, jadi klik beruntun tidak membanjiri server target.
      const result = await runDdosCheck(server);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(interaction.customId).setLabel('Cek Ulang').setEmoji('🔄').setStyle(ButtonStyle.Primary)
      );
      await interaction.editReply({ embeds: [createDdosCheckEmbed(result, server)], components: [row] });
    } catch (err) {
      await interaction.editReply({ embeds: [createErrorEmbed('Gagal Cek', `❌ **${server}**: ${err.message}`)], components: [] });
    }
  },
};
