import { findPlayerByName } from '../services/fivem/playerService.js';
import { getServerStatus } from '../services/fivem/serverService.js';
import { createPlayerResultEmbed, createPlayerNotFoundEmbed, createServerEmbed, createServerOfflineEmbed, createErrorEmbed } from '../utils/embed.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { requireSubscription } from '../utils/subscription.js';

export default {
  customId: 'refresh',

  async execute(interaction) {
    const parts = interaction.customId.split('|');
    const type = parts[1];
    const cfx = parts[2];
    const extra = parts[3];

    // Refresh hasil !player = fitur premium (refresh status server tetap gratis).
    if (type === 'player') {
      const check = requireSubscription({ guild: interaction.guild, author: interaction.user });
      if (!check.allowed) {
        return interaction.reply({ embeds: [check.embed], ephemeral: true }).catch(() => {});
      }
    }

    await interaction.deferUpdate();

    try {
      if (type === 'player') {
        const nama = extra || '';
        const { found, serverData, endpoint, dbRow } = await findPlayerByName(cfx, nama);
        const hostname = serverData?.Data?.hostname?.replace(/\^[0-9]/g, '').trim() || cfx;
        const bannerUrl = dbRow?.banner_url || null;

        if (!found.length) {
          return interaction.editReply({
            embeds: [createPlayerNotFoundEmbed(nama, hostname)],
            components: interaction.message.components,
          });
        }
        const embed = createPlayerResultEmbed(found, nama, hostname, endpoint, bannerUrl);
        return interaction.editReply({ embeds: [embed], components: interaction.message.components });
      }

      if (type === 'status') {
        const status = await getServerStatus(cfx);
        const bannerUrl = status.dbRow?.banner_url || null;

        if (!status.online) {
          return interaction.editReply({
            embeds: [createServerOfflineEmbed(cfx, status.error)],
            components: interaction.message.components,
          });
        }
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`refresh|status|${cfx}`).setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`allplayer|view|${cfx}|1`).setLabel('Lihat Players').setEmoji('👥').setStyle(ButtonStyle.Primary),
        );
        return interaction.editReply({
          embeds: [createServerEmbed(status.serverData, cfx, status, bannerUrl)],
          components: [row],
        });
      }
    } catch (err) {
      await interaction.editReply({
        embeds: [createErrorEmbed('Refresh Gagal', err.message)],
        components: [],
      });
    }
  },
};
