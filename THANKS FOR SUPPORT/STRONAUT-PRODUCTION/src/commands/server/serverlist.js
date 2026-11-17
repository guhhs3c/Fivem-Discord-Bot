import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createErrorEmbed, SEPARATOR, maskEndpoint } from '../../utils/embed.js';
import { config } from '../../config/config.js';
import { getDb } from '../../database/db.js';

export default {
  name: 'serverlist',
  aliases: ['sl', 'servers', 'daftarserver'],
  description: 'Daftar server FiveM yang tersedia',
  usage: `${config.bot.prefix}serverlist`,
  example: `${config.bot.prefix}serverlist`,
  cooldown: 5,

  async execute(message) {
    const db = getDb();
    const servers = db.prepare(`SELECT * FROM servers WHERE is_active = 1 ORDER BY name ASC`).all();

    if (!servers.length) {
      return message.reply({
        embeds: [createErrorEmbed('Tidak Ada Server', 'Belum ada server di database.\nHubungi admin untuk menambahkan server.')],
      });
    }

    await message.reply({
      embeds: [buildEmbed(servers, 0)],
      components: [buildRow(servers, 0)],
    });
  },
};

export function buildEmbed(servers, idx) {
  const s = servers[Math.max(0, Math.min(idx, servers.length - 1))];
  const total = servers.length;
  const aliases = s.alias ? s.alias.split(',').map(a => a.trim()).filter(Boolean) : [];
  const endpoint = maskEndpoint();
  const firstAlias = aliases[0] || (s.name?.toLowerCase().replace(/\s+/g, '') || 'server');

  return new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`🎮 ${s.name || 'Server FiveM'}`)
    .setDescription(
      `${SEPARATOR}\n\n` +
      `📡 **Endpoint:** \`${endpoint}\`\n` +
      `🏷️ **Alias:** ${aliases.length ? aliases.map(a => `\`${a}\``).join(' · ') : 'N/A'}\n\n` +
      `**Contoh Penggunaan:**\n` +
      `\`${config.bot.prefix}player ${firstAlias} <nama_player>\`\n` +
      `\`${config.bot.prefix}checkstatus ${firstAlias}\`\n` +
      `\`${config.bot.prefix}allplayer ${firstAlias}\`\n\n` +
      `${SEPARATOR}`
    )
    .setFooter({ text: `${config.bot.name} • Server ${idx + 1} dari ${total}` })
    .setTimestamp()
    .setImage(s.banner_url || null);
}

export function buildRow(servers, idx) {
  const total = servers.length;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`serverlist:prev:${idx + 1}`)
      .setLabel('Prev')
      .setEmoji('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(idx <= 0),
    new ButtonBuilder()
      .setCustomId(`serverlist:page:${idx + 1}`)
      .setLabel(`${idx + 1} / ${total}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`serverlist:next:${idx + 1}`)
      .setLabel('Next')
      .setEmoji('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(idx >= total - 1),
  );
}
