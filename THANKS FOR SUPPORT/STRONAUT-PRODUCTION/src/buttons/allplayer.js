import { getAllPlayers } from '../services/fivem/playerService.js';
import { createErrorEmbed, SEPARATOR } from '../utils/embed.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config/config.js';

const PER_PAGE = 20;

export default {
  customId: 'allplayer',
  premium: true,

  async execute(interaction) {
    const parts = interaction.customId.split('|');
    const action = parts[1];
    const cfx = parts[2];
    let page = parseInt(parts[3]) || 1;

    if (action === 'next') page += 1;
    else if (action === 'prev') page = Math.max(1, page - 1);

    await interaction.deferUpdate();

    try {
      const { players, serverData, dbRow } = await getAllPlayers(cfx);
      const hostname = serverData?.Data?.hostname?.replace(/\^[0-9]/g, '').trim() || cfx;
      const bannerUrl = dbRow?.banner_url || null;

      if (!players.length) {
        return interaction.editReply({
          embeds: [createErrorEmbed('Server Kosong', 'Tidak ada player online di server ini.')],
          components: [],
        });
      }

      const totalPages = Math.ceil(players.length / PER_PAGE);
      const safePage = Math.min(Math.max(1, page), totalPages);
      const start = (safePage - 1) * PER_PAGE;
      const pageItems = players.slice(start, start + PER_PAGE);

      const lines = pageItems.map((p, i) => {
        const ping = p.ping ?? '?';
        const emoji = ping === '?' ? '⬜' : ping < 80 ? '🟢' : ping < 150 ? '🟡' : '🔴';
        return `\`${String(start + i + 1).padStart(2, ' ')}\` **${p.name}** · ID \`${p.id}\` · ${emoji} \`${ping}ms\``;
      });

      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setAuthor({ name: `🎮 ${hostname}` })
        .setTitle(`👥 Players Online`)
        .setDescription(lines.join('\n'))
        .addFields(
          { name: '📊 Total', value: `\`${players.length}\``, inline: true },
          { name: '📄 Halaman', value: `\`${safePage}/${totalPages}\``, inline: true },
        )
        .setFooter({ text: `${config.bot.name} • v${config.bot.version}` })
        .setTimestamp()
        .setImage(bannerUrl || null);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`allplayer|prev|${cfx}|${safePage}`)
          .setLabel('Prev').setEmoji('◀').setStyle(ButtonStyle.Secondary).setDisabled(safePage <= 1),
        new ButtonBuilder()
          .setCustomId(`allplayer|refresh|${cfx}|${safePage}`)
          .setLabel('Refresh').setEmoji('🔄').setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`allplayer|next|${cfx}|${safePage}`)
          .setLabel('Next').setEmoji('▶').setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages),
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
      await interaction.editReply({ embeds: [createErrorEmbed('Gagal Refresh', err.message)], components: [] });
    }
  },
};
