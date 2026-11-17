import { EmbedBuilder } from 'discord.js';
import { createErrorEmbed, createSuccessEmbed } from '../../utils/embed.js';
import { getDb } from '../../database/db.js';
import { config } from '../../config/config.js';

function requireOwner(message) {
  if (message.author.id !== config.discord.ownerId) {
    return {
      allowed: false,
      embed: createErrorEmbed('Akses Ditolak', 'Command ini hanya bisa digunakan oleh Owner bot.'),
    };
  }
  return { allowed: true };
}

export default {
  name: 'setserver',
  aliases: ['addserver', 'tambahserver'],
  description: 'Tambah/update server di database (Owner only)',
  usage: `${config.bot.prefix}setserver <cfx_atau_ip:port> <nama> [alias1,alias2] [banner_url]`,
  slashOptions: [
    { name: 'server', description: 'Kode CFX.re atau ip:port server', required: true },
    { name: 'nama', description: 'Nama server (tanpa spasi, atau pakai underscore)', required: true },
    { name: 'alias', description: 'Alias tambahan, pisahkan dengan koma (opsional)', required: false },
    { name: 'banner_url', description: 'URL gambar banner server (opsional)', required: false },
  ],
  example: `${config.bot.prefix}setserver abc123 NamaServer namaserver,ns https://img.url/banner.png`,
  cooldown: 5,

  async execute(message, args) {
    const { allowed, embed: ownerEmbed } = requireOwner(message);
    if (!allowed) return message.reply({ embeds: [ownerEmbed] });

    if (args.length < 2) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Kurang Argumen',
          `**Penggunaan:** \`${config.bot.prefix}setserver <cfx_atau_ip:port_atau_domain:port> <nama> [alias] [banner]\`\n\n` +
          `**Contoh CFX:** \`${config.bot.prefix}setserver abc123 Server Keren serverkeren,sk\`\n` +
          `**Contoh IP:** \`${config.bot.prefix}setserver [HIDDEN] Server Keren serverkeren\`\n` +
          `**Contoh Domain:** \`${config.bot.prefix}setserver play.server.com:30120 Server Keren serverkeren\``
        )],
      });
    }

    const endpoint = args[0];
    const nama = args[1];
    const alias = args[2] || '';
    const bannerUrl = args[3] || null;

    // Detect if it's a CFX code or direct address
    const isCfx = /^[a-zA-Z0-9]+$/.test(endpoint) && !endpoint.includes(':');

    const db = getDb();
    const existing = db.prepare(`SELECT id FROM servers WHERE cfx_code = ? OR endpoint = ?`).get(endpoint, endpoint);

    if (existing) {
      db.prepare(`UPDATE servers SET name = ?, alias = ?, banner_url = ?, endpoint = ?, is_active = 1 WHERE id = ?`)
        .run(nama, alias, bannerUrl, endpoint, existing.id);
    } else {
      db.prepare(`INSERT INTO servers (name, cfx_code, endpoint, alias, banner_url, added_by) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(nama, isCfx ? endpoint : null, endpoint, alias, bannerUrl, message.author.tag);
    }

    await message.reply({
      embeds: [createSuccessEmbed(
        existing ? 'Server Diupdate' : 'Server Ditambahkan',
        `✅ **${nama}** berhasil ${existing ? 'diupdate' : 'ditambahkan'}\n\n` +
        `📡 **Endpoint:** \`${endpoint}\`\n` +
        `🏷️ **Alias:** ${alias || 'N/A'}\n` +
        `🖼️ **Banner:** ${bannerUrl ? '✅' : '❌'}`
      )],
    });
  },
};
