import { EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { createErrorEmbed, createLoadingEmbed, SEPARATOR } from '../../utils/embed.js';
import { config } from '../../config/config.js';

export default {
  name: 'geoip',
  aliases: ['ip', 'ipinfo'],
  description: 'Lokasi & info IP address',
  usage: `${config.bot.prefix}geoip <ip>`,
  slashOptions: [
    { name: 'ip', description: 'IP address yang mau dicek', required: true },
  ],
  example: `${config.bot.prefix}geoip 8.8.8.8`,
  cooldown: 5,

  async execute(message, args) {
    if (!args[0]) {
      return message.reply({ embeds: [createErrorEmbed('Kurang Argumen', `**Penggunaan:** \`${config.bot.prefix}geoip <ip>\``)] });
    }

    const ip = args[0];
    const loadingMsg = await message.reply({ embeds: [createLoadingEmbed(`Mencari info IP \`${ip}\`...`)] });

    try {
      const { data } = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,isp,org,as,query,lat,lon,timezone,mobile,proxy,hosting`, { timeout: 8000 });

      if (data.status !== 'success') {
        return loadingMsg.edit({ embeds: [createErrorEmbed('IP Tidak Valid', data.message || 'IP tidak dapat diproses.')] });
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`🌍 GeoIP — ${data.query}`)
        .setDescription(`${SEPARATOR}`)
        .addFields(
          { name: '📍 Lokasi', value: `${data.city}, ${data.regionName}, ${data.country}`, inline: false },
          { name: '🏢 ISP', value: `\`${data.isp || 'N/A'}\``, inline: true },
          { name: '🏛️ Org', value: `\`${data.org || 'N/A'}\``, inline: true },
          { name: '🕐 Timezone', value: `\`${data.timezone || 'N/A'}\``, inline: true },
          { name: '📡 AS', value: `\`${data.as || 'N/A'}\``, inline: false },
          { name: '🔍 Proxy/VPN', value: data.proxy ? '⚠️ Ya' : '✅ Tidak', inline: true },
          { name: '📱 Mobile', value: data.mobile ? '✅ Ya' : '❌ Tidak', inline: true },
          { name: '🖥️ Hosting', value: data.hosting ? '✅ Ya' : '❌ Tidak', inline: true },
        )
        .setFooter({ text: `${config.bot.name} • ip-api.com` })
        .setTimestamp();

      await loadingMsg.edit({ embeds: [embed] });
    } catch (err) {
      await loadingMsg.edit({ embeds: [createErrorEmbed('Gagal Query', err.message)] });
    }
  },
};
