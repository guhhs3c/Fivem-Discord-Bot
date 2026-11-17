import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getServerStatus } from '../../services/fivem/serverService.js';
import { createServerEmbed, createServerOfflineEmbed, createErrorEmbed, createLoadingEmbed } from '../../utils/embed.js';
import { config } from '../../config/config.js';

export default {
  name: 'checkstatus',
  aliases: ['cs', 'status', 'cek'],
  description: 'Cek status server FiveM (online/offline)',
  usage: `${config.bot.prefix}checkstatus <server>`,
  slashOptions: [
    { name: 'server', description: 'Nama/alias server FiveM', required: true },
  ],
  example: `${config.bot.prefix}checkstatus satumimpi\n${config.bot.prefix}cs play.server.com:30120`,
  cooldown: 5,

  async execute(message, args) {
    if (!args[0]) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Kurang Argumen',
          `**Penggunaan:** \`${config.bot.prefix}checkstatus <server>\`\n` +
          `**Contoh:**\n• \`${config.bot.prefix}cs satumimpi\` *(alias)*\n` +
          `• \`${config.bot.prefix}cs play.server.com:30120\` *(domain:port)*\n` +
          `• \`${config.bot.prefix}cs [HIDDEN]\` *(IP:port)*`
        )],
      });
    }

    const serverInput = args[0];
    const loadingMsg = await message.reply({
      embeds: [createLoadingEmbed(`Mengecek status **${serverInput}**...`)],
    });

    try {
      const status = await getServerStatus(serverInput);
      const bannerUrl = status.dbRow?.banner_url || null;

      if (!status.online) {
        return loadingMsg.edit({
          embeds: [createServerOfflineEmbed(serverInput, status.error)],
          components: [],
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`refresh|status|${serverInput}`)
          .setLabel('Refresh')
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`allplayer|view|${serverInput}|1`)
          .setLabel('Lihat Players')
          .setEmoji('👥')
          .setStyle(ButtonStyle.Primary),
      );

      await loadingMsg.edit({
        embeds: [createServerEmbed(status.serverData, serverInput, status, bannerUrl)],
        components: [row],
      });
    } catch (err) {
      await loadingMsg.edit({
        embeds: [createErrorEmbed('Gagal Cek Status', `❌ **${serverInput}**: ${err.message}`)],
        components: [],
      });
    }
  },
};
