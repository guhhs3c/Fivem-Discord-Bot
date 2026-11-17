import { createErrorEmbed } from '../../utils/embed.js';
import { config } from '../../config/config.js';
import { buildDmEmbed, runBulkDm, isOwner } from '../../utils/dmBroadcast.js';

// =======================================================
// Command: !dmglobal  (slash: /dmglobal)
// Kirim DM ke SEMUA user di SEMUA server yang dimasuki bot.
// User yang ada di banyak server hanya dikirimi 1x.
// (Owner only)
// =======================================================

export default {
  name: 'dmglobal',
  aliases: ['dmsemuaserver'],
  description: 'Kirim DM ke semua user di semua server bot (Owner only)',
  usage: `${config.bot.prefix}dmglobal <pesan>`,
  slashOptions: [
    { name: 'pesan', description: 'Isi pesan yang dikirim', required: true },
  ],
  example: `${config.bot.prefix}dmglobal Update besar STRONAUT v5.2 sudah rilis!`,
  cooldown: 60,

  async execute(message, args, client) {
    if (!isOwner(message.author.id)) {
      return message.reply({
        embeds: [createErrorEmbed('Akses Ditolak', 'Command ini hanya untuk Owner bot.')],
      });
    }

    const text = args.join(' ').trim();
    if (!text) {
      return message.reply({
        embeds: [createErrorEmbed('Pesan Kosong', `Pakai: \`${config.bot.prefix}dmglobal <pesan>\``)],
      });
    }
    if (text.length > 1800) {
      return message.reply({ embeds: [createErrorEmbed('Pesan Terlalu Panjang', 'Maksimal 1800 karakter.')] });
    }

    // Kumpulkan user unik dari semua server
    const unik = new Map();
    for (const guild of client.guilds.cache.values()) {
      try {
        const members = await guild.members.fetch();
        for (const m of members.values()) {
          if (!m.user.bot) unik.set(m.user.id, m.user);
        }
      } catch (err) {
        console.error(`[dmglobal] gagal fetch member ${guild.name}: ${err.message}`);
      }
    }

    const targets = [...unik.values()];
    if (!targets.length) {
      return message.reply({ embeds: [createErrorEmbed('Tidak Ada Penerima', 'Tidak ada user yang bisa dikirimi.')] });
    }

    const embed = buildDmEmbed(
      text,
      `Pengumuman dari ${config.bot.name} • kamu menerima ini karena ada di server yang memakai bot ini`
    );

    return runBulkDm({
      message,
      users: targets,
      embed,
      scopeText: `user unik dari **${client.guilds.cache.size}** server`,
      customKey: message.id,
    });
  },
};
