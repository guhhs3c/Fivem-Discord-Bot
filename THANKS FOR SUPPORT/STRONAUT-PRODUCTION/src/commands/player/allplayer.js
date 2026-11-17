import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getAllPlayers } from '../../services/fivem/playerService.js';
import { createErrorEmbed, createLoadingEmbed, SEPARATOR } from '../../utils/embed.js';
import { config } from '../../config/config.js';

const PER_PAGE = 20;

export default {
  name: 'allplayer',
  premium: true,
  aliases: ['ap', 'players'],
  description: 'Lihat semua player online di server FiveM',
  usage: `${config.bot.prefix}allplayer <server> [halaman]`,
  slashOptions: [
    { name: 'server', description: 'Nama/alias server FiveM', required: true },
    { name: 'halaman', description: 'Nomor halaman (opsional)', required: false },
  ],
  example: `${config.bot.prefix}allplayer satumimpi\n${config.bot.prefix}allplayer smrp 2`,
  cooldown: 10,

  async execute(message, args) {
    if (!args[0]) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Kurang Argumen',
          `**Penggunaan:** \`${config.bot.prefix}allplayer <server> [halaman]\`\n**Contoh:** \`${config.bot.prefix}allplayer satumimpi\`\n\nGunakan \`${config.bot.prefix}serverlist\` untuk daftar server.`
        )],
      });
    }

    const serverInput = args[0];
    const page = parseInt(args[1]) || 1;

    const loadingMsg = await message.reply({
      embeds: [createLoadingEmbed(`Mengambil daftar player dari **${serverInput}**...`)],
    });

    try {
      const { players, serverData, dbRow } = await getAllPlayers(serverInput);
      const hostname = serverData?.Data?.hostname?.replace(/\^[0-9]/g, '').trim() || serverInput;
      const bannerUrl = dbRow?.banner_url || null;

      if (!players.length) {
        return loadingMsg.edit({
          embeds: [createErrorEmbed('Server Kosong', `Tidak ada player online di **${hostname}**.`)],
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
          .setCustomId(`allplayer|prev|${serverInput}|${safePage}`)
          .setLabel('Prev')
          .setEmoji('◀')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage <= 1),
        new ButtonBuilder()
          .setCustomId(`allplayer|refresh|${serverInput}|${safePage}`)
          .setLabel('Refresh')
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`allplayer|next|${serverInput}|${safePage}`)
          .setLabel('Next')
          .setEmoji('▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage >= totalPages),
      );

      await loadingMsg.edit({ embeds: [embed], components: [row] });
    } catch (err) {
      await loadingMsg.edit({
        embeds: [createErrorEmbed('Gagal Mengambil Data', `❌ **${serverInput}**: ${err.message}`)],
        components: [],
      });
    }
  },
};
