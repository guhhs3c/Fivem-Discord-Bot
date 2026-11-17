import { EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { createErrorEmbed, createLoadingEmbed, SEPARATOR } from '../../utils/embed.js';
import { config } from '../../config/config.js';

const http = axios.create({ timeout: 10000 });

const GAMES = {
  csgo: { name: 'CS:GO / CS2', key: 'csgo' },
  cs2: { name: 'CS2', key: 'csgo' },
  rust: { name: 'Rust', key: 'rust' },
  ark: { name: 'ARK: Survival Evolved', key: 'ark' },
  gmod: { name: "Garry's Mod", key: 'gmod' },
  tf2: { name: 'Team Fortress 2', key: 'tf2' },
  dayz: { name: 'DayZ', key: 'dayz' },
};

export default {
  name: 'gameserver',
  aliases: ['gs'],
  description: 'Cek status server game via Battlemetrics',
  usage: `${config.bot.prefix}gameserver <ip> <port> <game>`,
  slashOptions: [
    { name: 'ip', description: 'IP address server', required: true },
    { name: 'port', description: 'Port server', required: true },
    {
      name: 'game',
      description: 'Jenis game',
      required: true,
      choices: [
        { name: 'CS:GO / CS2', value: 'csgo' },
        { name: 'Rust', value: 'rust' },
        { name: 'ARK: Survival Evolved', value: 'ark' },
        { name: "Garry's Mod", value: 'gmod' },
        { name: 'Team Fortress 2', value: 'tf2' },
        { name: 'DayZ', value: 'dayz' },
      ],
    },
  ],
  example: `${config.bot.prefix}gameserver 1.2.3.4 27015 csgo`,
  cooldown: 8,

  async execute(message, args) {
    const GAME_LIST = Object.keys(GAMES).join(', ');
    if (args.length < 3) {
      return message.reply({
        embeds: [createErrorEmbed('Kurang Argumen', `**Penggunaan:** \`${config.bot.prefix}gameserver <ip> <port> <game>\`\n**Game:** \`${GAME_LIST}\``)],
      });
    }

    const ip = args[0];
    const port = parseInt(args[1]);
    const gameKey = args[2].toLowerCase();

    if (isNaN(port)) return message.reply({ embeds: [createErrorEmbed('Port Tidak Valid', 'Port harus berupa angka.')] });
    const gameInfo = GAMES[gameKey];
    if (!gameInfo) return message.reply({ embeds: [createErrorEmbed('Game Tidak Dikenali', `Game tersedia: \`${GAME_LIST}\``)] });

    const loadingMsg = await message.reply({ embeds: [createLoadingEmbed(`Mencari server ${gameInfo.name} \`${ip}:${port}\`...`)] });

    try {
      const { data } = await http.get(
        `https://api.battlemetrics.com/servers?filter[search]=${ip}&filter[game]=${gameInfo.key}&page[size]=5`,
        { headers: { Accept: 'application/json' } }
      );

      const server = data?.data?.find(s => s.attributes?.ip === ip && s.attributes?.port === port) || data?.data?.[0];
      if (!server) {
        return loadingMsg.edit({ embeds: [createErrorEmbed('Server Tidak Ditemukan', `Server \`${ip}:${port}\` tidak ditemukan di Battlemetrics.`)] });
      }

      const attr = server.attributes;
      const online = attr.status === 'online';
      const filled = attr.maxPlayers ? Math.min(10, Math.round((attr.players / attr.maxPlayers) * 10)) : 0;
      const bar = '`' + '█'.repeat(filled) + '░'.repeat(10 - filled) + '`';

      const embed = new EmbedBuilder()
        .setColor(online ? config.colors.success : config.colors.danger)
        .setTitle(`${online ? '🟢' : '🔴'} ${gameInfo.name}`)
        .setDescription(`${SEPARATOR}`)
        .addFields(
          { name: '🏷️ Nama', value: attr.name || 'N/A', inline: false },
          { name: `👥 Players — ${attr.players}/${attr.maxPlayers}`, value: bar, inline: false },
          { name: '🗺️ Map', value: `\`${attr.details?.map || 'N/A'}\``, inline: true },
          { name: '🌍 Country', value: attr.country || 'N/A', inline: true },
          { name: '📡 IP', value: `\`${attr.ip}:${attr.port}\``, inline: true },
          { name: '🔗 Battlemetrics', value: `[Lihat →](https://www.battlemetrics.com/servers/${gameInfo.key}/${server.id})` },
        )
        .setFooter({ text: `${config.bot.name} • Game Server Query` })
        .setTimestamp();

      await loadingMsg.edit({ embeds: [embed] });
    } catch (err) {
      await loadingMsg.edit({ embeds: [createErrorEmbed('Gagal Query', err.message)] });
    }
  },
};
