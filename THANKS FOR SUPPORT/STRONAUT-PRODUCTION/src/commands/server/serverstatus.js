import { EmbedBuilder } from 'discord.js';
import { getServerStatus } from '../../services/fivem/serverService.js';
import { createErrorEmbed, createLoadingEmbed, SEPARATOR } from '../../utils/embed.js';
import { config } from '../../config/config.js';

export default {
  name: 'serverstatus',
  aliases: ['ss', 'serverinfo'],
  description: 'Detail lengkap info server FiveM',
  usage: `${config.bot.prefix}serverstatus <server>`,
  slashOptions: [
    { name: 'server', description: 'Nama/alias server FiveM', required: true },
  ],
  example: `${config.bot.prefix}serverstatus satumimpi\n${config.bot.prefix}ss play.server.com:30120`,
  cooldown: 10,

  async execute(message, args) {
    if (!args[0]) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Kurang Argumen',
          `**Penggunaan:** \`${config.bot.prefix}serverstatus <server>\`\n` +
          `**Contoh:**\n• \`${config.bot.prefix}ss satumimpi\` *(alias)*\n` +
          `• \`${config.bot.prefix}ss play.server.com:30120\` *(domain:port)*`
        )],
      });
    }

    const serverInput = args[0];
    const loadingMsg = await message.reply({
      embeds: [createLoadingEmbed(`Mengambil detail server **${serverInput}**...`)],
    });

    try {
      const status = await getServerStatus(serverInput);
      if (!status.online) {
        return loadingMsg.edit({
          embeds: [createErrorEmbed('Server Offline', `Server **${serverInput}** sedang offline atau tidak dapat dijangkau.`)],
          components: [],
        });
      }

      const sv = status.sv ?? {};
      const vars = sv?.vars ?? {};
      const tags = vars.tags
        ? vars.tags.split(',').slice(0, 5).map(t => `\`${t.trim()}\``).join(' ')
        : '`N/A`';
      const locale = vars.locale || 'N/A';
      const gametype = vars.gametype || 'N/A';
      const mapname = vars.mapname || 'N/A';
      const scriptHookAllowed = vars.sv_scriptHookAllowed === '1' ? '✅' : '❌';
      const bannerUrl = status.dbRow?.banner_url || null;

      const filled = status.maxPlayers > 0
        ? Math.min(10, Math.round((status.playerCount / status.maxPlayers) * 10))
        : 0;
      const bar = '`' + '█'.repeat(filled) + '░'.repeat(10 - filled) + '`';

      const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle(`🟢 ${status.hostname}`)
        .setDescription(`${SEPARATOR}`)
        .addFields(
          { name: `👥 Players — ${status.playerCount}/${status.maxPlayers}`, value: bar, inline: false },
          { name: '🎮 Gametype', value: `\`${gametype}\``, inline: true },
          { name: '🗺️ Map', value: `\`${mapname}\``, inline: true },
          { name: '🌍 Locale', value: `\`${locale}\``, inline: true },
          { name: '🔄 OneSync', value: status.oneSync ? '✅ Aktif' : '❌ Nonaktif', inline: true },
          { name: '🎣 ScriptHook', value: scriptHookAllowed, inline: true },
          { name: '🏷️ Tags', value: tags, inline: false },
          { name: '🔗 Connect', value: `\`connect ${status.endpoint}\``, inline: false },
        )
        .setFooter({ text: `${config.bot.name} • v${config.bot.version}` })
        .setTimestamp();

      if (bannerUrl) embed.setImage(bannerUrl);

      await loadingMsg.edit({ embeds: [embed], components: [] });
    } catch (err) {
      await loadingMsg.edit({
        embeds: [createErrorEmbed('Gagal Mengambil Data', `❌ **${serverInput}**: ${err.message}`)],
        components: [],
      });
    }
  },
};
