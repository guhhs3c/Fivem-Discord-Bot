import { findPlaytimeByName, addPlaytimeSubscription } from '../../services/fivem/playtimeService.js';
import { createErrorEmbed, createWarningEmbed, createSuccessEmbed } from '../../utils/embed.js';
import { config } from '../../config/config.js';

export default {
  name: 'settime',
  premium: true,
  aliases: ['setplaytime'],
  description: 'Langganan laporan playtime otomatis tiap pagi (sebelum reset jam 06:00 WIB)',
  usage: `${config.bot.prefix}settime <server> <nama>`,
  slashOptions: [
    { name: 'server', description: 'Nama/alias server FiveM', required: true },
    { name: 'nama', description: 'Nama player yang mau dilaporkan', required: true },
  ],
  example: `${config.bot.prefix}settime satumimpi Cortez`,
  cooldown: 5,

  async execute(message, args) {
    if (args.length < 2) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Kurang Argumen',
          `**Penggunaan:** \`${config.bot.prefix}settime <server> <nama>\`\n` +
          `**Contoh:** \`${config.bot.prefix}settime satumimpi Cortez\``
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
          `Belum ada data untuk **${nama}** di server **${serverInput}**.\n` +
          `Pastikan pemainnya pernah online dulu biar kedeteksi bot (dicek tiap 1 menit), baru coba \`${config.bot.prefix}settime\` lagi.`
        )],
      });
    }

    addPlaytimeSubscription(message.author.id, serverInput, player.identifier, player.name);

    return message.reply({
      embeds: [createSuccessEmbed(
        'Langganan Aktif',
        `Laporan playtime **${player.name}** di server **${serverInput}** bakal dikirim ke DM kamu ` +
        `tiap pagi jam **05:55 WIB** (5 menit sebelum reset server jam 06:00 WIB).\n\n` +
        `Pastikan DM dari member server ini kebuka ya. Ketik \`${config.bot.prefix}stoptime\` buat berhenti.`
      )],
    });
  },
};
