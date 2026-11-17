import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createErrorEmbed, SEPARATOR } from '../../utils/embed.js';
import { config } from '../../config/config.js';

export default {
  name: 'dev',
  aliases: ['devinfo', 'botinfo'],
  description: 'Info developer bot (Owner only)',
  usage: `${config.bot.prefix}dev`,
  example: `${config.bot.prefix}dev`,
  cooldown: 10,

  async execute(message, args, client) {
    if (message.author.id !== config.discord.ownerId) {
      return message.reply({ embeds: [createErrorEmbed('Akses Ditolak', 'Command ini hanya untuk Owner bot.')] });
    }

    const guilds = client.guilds.cache.size;
    let totalUsers = 0;
    client.guilds.cache.forEach(g => { totalUsers += g.memberCount; });

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('👨‍💻 Developer Info')
      .setDescription(`${SEPARATOR}\n\n**${config.bot.name}** — Discord bot gaming komunitas Indonesia.\n\n${SEPARATOR}`)
      .addFields(
        { name: '🤖 Bot Name', value: `\`${config.bot.name}\``, inline: true },
        { name: '📦 Version', value: `\`v${config.bot.version}\``, inline: true },
        { name: '⚡ Framework', value: '`discord.js v14`', inline: true },
        { name: '🖥️ Runtime', value: '`Node.js 18+`', inline: true },
        { name: '🏠 Servers', value: `\`${guilds}\``, inline: true },
        { name: '👥 Users', value: `\`${totalUsers.toLocaleString()}\``, inline: true },
        { name: '💾 Database', value: '`SQLite (better-sqlite3)`', inline: true },
        { name: '⏱️ Uptime', value: `\`${formatUptime(process.uptime())}\``, inline: true },
        { name: '💡 Prefix', value: `\`${config.bot.prefix}\``, inline: true },
        { name: '🌍 Hosting', value: process.env.RAILWAY_ENVIRONMENT ? '`Railway`' : '`Self-hosted`', inline: true },
        { name: '🔑 Owner', value: config.discord.ownerId ? `<@${config.discord.ownerId}>` : 'N/A', inline: true },
      )
      .setFooter({ text: `${config.bot.name} • Owner-only command` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  },
};

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}
