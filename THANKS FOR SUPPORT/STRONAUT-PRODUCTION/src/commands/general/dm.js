import { PermissionsBitField } from 'discord.js';
import { createErrorEmbed, createSuccessEmbed, createWarningEmbed } from '../../utils/embed.js';
import { config } from '../../config/config.js';
import { buildDmEmbed, sendOneDm, parseUserId, isOwner } from '../../utils/dmBroadcast.js';

// =======================================================
// Command: !dm  (slash: /dm)
// Kirim DM ke SATU user lewat bot.
// Boleh dipakai: Owner bot, atau Administrator di server tsb.
// =======================================================

export default {
  name: 'dm',
  aliases: ['kirimdm'],
  description: 'Kirim DM ke satu user lewat bot (Admin/Owner)',
  usage: `${config.bot.prefix}dm <@user atau ID> <pesan>`,
  slashOptions: [
    { name: 'target', description: 'Mention atau ID user tujuan', required: true },
    { name: 'pesan', description: 'Isi pesan yang dikirim', required: true },
  ],
  example: `${config.bot.prefix}dm @user Halo, tiketmu sudah kami proses ya!`,
  cooldown: 5,

  async execute(message, args, client) {
    const owner = isOwner(message.author.id);
    const admin = message.member?.permissions?.has(PermissionsBitField.Flags.Administrator);

    if (!owner && !admin) {
      return message.reply({
        embeds: [createErrorEmbed('Akses Ditolak', 'Command ini hanya untuk Administrator server atau Owner bot.')],
      });
    }

    const targetId = parseUserId(args[0]);
    const text = args.slice(1).join(' ').trim();

    if (!targetId || !text) {
      return message.reply({
        embeds: [createErrorEmbed('Format Salah', `Pakai: \`${config.bot.prefix}dm <@user atau ID> <pesan>\``)],
      });
    }
    if (text.length > 1800) {
      return message.reply({ embeds: [createErrorEmbed('Pesan Terlalu Panjang', 'Maksimal 1800 karakter.')] });
    }

    const user = await client.users.fetch(targetId).catch(() => null);
    if (!user) {
      return message.reply({ embeds: [createErrorEmbed('User Tidak Ditemukan', 'ID user tidak valid.')] });
    }
    if (user.bot) {
      return message.reply({ embeds: [createErrorEmbed('Gagal', 'Tidak bisa mengirim DM ke bot.')] });
    }

    const footer = message.guild ? `Dikirim oleh staff ${message.guild.name}` : `${config.bot.name}`;
    const hasil = await sendOneDm(user, buildDmEmbed(text, footer));

    if (hasil === 'ok') {
      return message.reply({ embeds: [createSuccessEmbed('DM Terkirim', `Pesan berhasil dikirim ke **${user.tag}**.`)] });
    }
    if (hasil === 'ditutup') {
      return message.reply({
        embeds: [createWarningEmbed('DM Ditutup', `**${user.tag}** menutup DM atau memblokir bot.`)],
      });
    }
    return message.reply({ embeds: [createErrorEmbed('Gagal', 'DM gagal dikirim. Cek log bot untuk detailnya.')] });
  },
};
