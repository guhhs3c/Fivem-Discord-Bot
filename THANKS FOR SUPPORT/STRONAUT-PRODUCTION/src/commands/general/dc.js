import { EmbedBuilder } from 'discord.js';
import { createErrorEmbed, SEPARATOR } from '../../utils/embed.js';
import { config } from '../../config/config.js';

// =======================================================
// Command: !dc
// Lihat semua server Discord tempat bot ini di-invite/masuk
// (Owner only — daftar server itu info sensitif)
// =======================================================

function footerText(extra) {
  return `${config.bot.name} • v${config.bot.version}${extra ? ` • ${extra}` : ''}`;
}

function chunkGuilds(guilds, perPage = 10) {
  const pages = [];
  for (let i = 0; i < guilds.length; i += perPage) {
    pages.push(guilds.slice(i, i + perPage));
  }
  return pages.length ? pages : [[]];
}

export default {
  name: 'dc',
  aliases: ['guildlist', 'daftarserverdc', 'listguild'],
  description: 'Lihat semua server Discord tempat bot ini masuk (Owner only)',
  usage: `${config.bot.prefix}dc`,
  example: `${config.bot.prefix}dc`,
  cooldown: 10,

  async execute(message, args, client) {
    if (message.author.id !== config.discord.ownerId) {
      return message.reply({ embeds: [createErrorEmbed('Akses Ditolak', 'Command ini hanya untuk Owner bot.')] });
    }

    const guilds = [...client.guilds.cache.values()].sort((a, b) => b.memberCount - a.memberCount);
    const totalUsers = guilds.reduce((sum, g) => sum + (g.memberCount || 0), 0);
    const pages = chunkGuilds(guilds, 10);

    const embeds = pages.map((page, index) => {
      const lines = page.length
        ? page
            .map((g, i) => {
              const rank = index * 10 + i + 1;
              const owner = g.ownerId ? `<@${g.ownerId}>` : 'N/A';
              return (
                `**${rank}. ${g.name}**\n` +
                `> 🆔 \`${g.id}\` • 👥 \`${g.memberCount.toLocaleString()}\` members • 👑 ${owner}`
              );
            })
            .join('\n\n')
        : 'Bot belum masuk ke server manapun.';

      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(index === 0 ? '🌐 Daftar Server Discord' : `🌐 Daftar Server — Halaman ${index + 1}/${pages.length}`)
        .setDescription(`${SEPARATOR}\n\n${lines}\n\n${SEPARATOR}`)
        .setFooter({ text: footerText(`Halaman ${index + 1}/${pages.length}`) })
        .setTimestamp();

      if (index === 0) {
        embed.setAuthor({ name: `👨‍💻 ${config.bot.name} • Owner-only` });
        embed.addFields(
          { name: '🏠 Total Server', value: `\`${guilds.length}\``, inline: true },
          { name: '👥 Total Users', value: `\`${totalUsers.toLocaleString()}\``, inline: true },
        );
      }

      return embed;
    });

    return message.reply({ embeds });
  },
};
