import { EmbedBuilder } from 'discord.js';
import {
  findPlaytimeByName,
  formatPlaytime,
  formatSinceWIB,
  formatDateWIB,
} from '../../services/fivem/playtimeService.js';
import { createErrorEmbed, createWarningEmbed } from '../../utils/embed.js';
import { config } from '../../config/config.js';

export default {
  name: 'playingtime',
  premium: true,
  aliases: ['pt', 'jammain'],
  description: 'Cek total jam main pemain di server FiveM',
  usage: `${config.bot.prefix}playingtime <server> <nama>`,
  slashOptions: [
    { name: 'server', description: 'Nama/alias server FiveM', required: true },
    { name: 'nama', description: 'Nama player yang mau dicek', required: true },
  ],
  example: `${config.bot.prefix}playingtime satumimpi cortez`,
  cooldown: 5,

  async execute(message, args) {
    if (args.length < 2) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Kurang Argumen',
          `**Penggunaan:** \`${config.bot.prefix}playingtime <server> <nama>\`\n` +
          `**Contoh:** \`${config.bot.prefix}playingtime satumimpi cortez\`\n\n` +
          `Gunakan \`${config.bot.prefix}serverlist\` untuk lihat daftar server.`
        )],
      });
    }

    const serverInput = args[0];
    const nama = args.slice(1).join(' ');

    const player = findPlaytimeByName(serverInput, nama);

    if (!player) {
      return message.reply({
        embeds: [createWarningEmbed(
          'Belum Ada Data',
          `Belum ada data playtime untuk **${nama}** di server **${serverInput}**.\n` +
          `Pemainnya harus pernah kedeteksi online dulu sama bot (dicek otomatis tiap 1 menit).`
        )],
      });
    }

    const status = player.is_online ? '🟢 Online' : '⚪ Offline';

    const description = [
      `> **Server:** \`${serverInput}\``,
      `> **Status:** ${status}`,
      '',
      `⏱️ **Total waktu main:** ${formatPlaytime(player.total_seconds)}`,
      `📅 **Waktu main hari ini:** ${formatPlaytime(player.daily_seconds)}`,
      '',
      `🆕 **Pertama kali kedeteksi main di server ini:**\n${formatDateWIB(player.first_seen)} (${formatSinceWIB(player.first_seen)})`,
      `🕐 **Terakhir online:** ${formatDateWIB(player.last_seen)}`,
    ].join('\n');

    const embed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle(`📊 Playing Time — ${player.name}`)
      .setDescription(description)
      .setFooter({ text: `${config.bot.name} • v${config.bot.version}` })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  },
};
