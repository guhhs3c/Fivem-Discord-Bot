import { EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { createErrorEmbed, createLoadingEmbed, SEPARATOR } from '../../utils/embed.js';
import { config } from '../../config/config.js';

export default {
  name: 'mc',
  aliases: ['minecraft', 'mcstatus'],
  description: 'Status server Minecraft (Java & Bedrock)',
  usage: `${config.bot.prefix}mc <host> [port]`,
  slashOptions: [
    { name: 'host', description: 'Alamat/IP server Minecraft', required: true },
    { name: 'port', description: 'Port server (opsional)', required: false },
  ],
  example: `${config.bot.prefix}mc play.hypixel.net\n${config.bot.prefix}mc play.server.net 25565`,
  cooldown: 8,

  async execute(message, args) {
    if (!args[0]) {
      return message.reply({ embeds: [createErrorEmbed('Kurang Argumen', `**Penggunaan:** \`${config.bot.prefix}mc <host> [port]\``)] });
    }

    const host = args[0];
    const port = args[1] || '25565';
    const loadingMsg = await message.reply({ embeds: [createLoadingEmbed(`Mengecek server Minecraft \`${host}:${port}\`...`)] });

    try {
      const { data } = await axios.get(`https://api.mcsrvstat.us/2/${host}:${port}`, { timeout: 10000 });

      if (!data.online) {
        return loadingMsg.edit({ embeds: [createErrorEmbed('Server Offline', `Server \`${host}:${port}\` tidak online.`)] });
      }

      const motd = (data.motd?.clean || []).join('\n') || 'N/A';
      const filled = data.players?.max ? Math.min(10, Math.round((data.players.online / data.players.max) * 10)) : 0;
      const bar = '`' + '█'.repeat(filled) + '░'.repeat(10 - filled) + '`';

      const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle(`🟢 ${host}`)
        .setDescription(`${SEPARATOR}\n\n*${motd}*\n\n${SEPARATOR}`)
        .addFields(
          { name: `👥 Players — ${data.players?.online}/${data.players?.max}`, value: bar, inline: false },
          { name: '📦 Version', value: `\`${data.version || 'N/A'}\``, inline: true },
          { name: '📡 IP', value: `\`${host}:${port}\``, inline: true },
          { name: '🌐 MOTD', value: motd.length > 50 ? '*(lihat di atas)*' : `\`${motd}\``, inline: false },
        )
        .setThumbnail(data.icon ? `https://api.mcsrvstat.us/icon/${host}:${port}` : null)
        .setFooter({ text: `${config.bot.name} • mcsrvstat.us` })
        .setTimestamp();

      await loadingMsg.edit({ embeds: [embed] });
    } catch (err) {
      await loadingMsg.edit({ embeds: [createErrorEmbed('Gagal Query', err.message)] });
    }
  },
};
