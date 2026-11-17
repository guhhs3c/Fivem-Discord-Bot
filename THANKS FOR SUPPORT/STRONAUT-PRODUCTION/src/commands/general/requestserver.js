import { createErrorEmbed, createSuccessEmbed } from '../../utils/embed.js';
import { getDb } from '../../database/db.js';
import { config } from '../../config/config.js';

export default {
  name: 'requestserver',
  aliases: ['req', 'tambah'],
  description: 'Request tambah server FiveM baru',
  usage: `${config.bot.prefix}requestserver <cfx_atau_ip:port> <nama server>`,
  slashOptions: [
    { name: 'server', description: 'Kode CFX.re atau ip:port server', required: true },
    { name: 'nama', description: 'Nama server yang mau didaftarkan', required: true },
  ],
  example: `${config.bot.prefix}requestserver abc123 Nama Server Saya\n${config.bot.prefix}req play.server.com:30120 Nama Server`,
  cooldown: 30,

  async execute(message, args) {
    if (args.length < 2) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Kurang Argumen',
          `**Penggunaan:** \`${config.bot.prefix}requestserver <cfx_atau_ip:port> <nama>\`\n\n` +
          `**Contoh:**\n• \`${config.bot.prefix}req abc123 Server Saya\`\n` +
          `• \`${config.bot.prefix}req play.server.com:30120 Server Saya\``
        )],
      });
    }

    const endpoint = args[0];
    const nama = args.slice(1).join(' ');

    try {
      getDb().prepare(
        `INSERT INTO server_requests (cfx_code, name, requested_by, guild_id) VALUES (?, ?, ?, ?)`
      ).run(endpoint, nama, message.author.tag, message.guild?.id);
    } catch {}

    await message.reply({
      embeds: [createSuccessEmbed(
        'Request Terkirim',
        `✅ Request server **${nama}** telah dikirim!\n\n` +
        `📡 **Endpoint:** \`${endpoint}\`\n` +
        `👤 **Diminta oleh:** ${message.author.tag}\n\n` +
        `> Admin akan mereview dan menambahkan server dalam waktu dekat.`
      )],
    });
  },
};
