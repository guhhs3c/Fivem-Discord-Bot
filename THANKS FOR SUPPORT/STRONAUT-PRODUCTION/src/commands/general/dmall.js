import { PermissionsBitField } from 'discord.js';
import { createErrorEmbed } from '../../utils/embed.js';
import { config } from '../../config/config.js';
import {
  buildDmEmbed,
  runBulkDm,
  parseRoleId,
  extractRoleFlag,
  isOwner,
} from '../../utils/dmBroadcast.js';

// =======================================================
// Command: !dmall  (slash: /dmall)
// Kirim DM ke SEMUA member server ini (opsional: hanya satu role).
// Boleh dipakai: Owner bot, atau Administrator di server tsb.
// Pakai konfirmasi + jeda + tombol Stop.
// =======================================================

export default {
  name: 'dmall',
  aliases: ['dmsemua'],
  description: 'Kirim DM ke semua member server ini, bisa dibatasi 1 role (Admin/Owner)',
  usage: `${config.bot.prefix}dmall <pesan> [--role <@role atau ID>]`,
  slashOptions: [
    { name: 'pesan', description: 'Isi pesan yang dikirim', required: true },
    { name: 'role', description: 'Opsional: hanya member dengan role ini (mention atau ID)', required: false, flag: 'role' },
  ],
  example: `${config.bot.prefix}dmall Event dimulai jam 21.00 WITA!\n${config.bot.prefix}dmall Rapat staff malam ini --role @Staff`,
  cooldown: 30,

  async execute(message, rawArgs, client) {
    if (!message.guild) {
      return message.reply({ embeds: [createErrorEmbed('Gagal', 'Command ini hanya bisa dipakai di dalam server.')] });
    }

    const owner = isOwner(message.author.id);
    const admin = message.member?.permissions?.has(PermissionsBitField.Flags.Administrator);
    if (!owner && !admin) {
      return message.reply({
        embeds: [createErrorEmbed('Akses Ditolak', 'Command ini hanya untuk Administrator server atau Owner bot.')],
      });
    }

    const { args, roleToken } = extractRoleFlag(rawArgs);
    const text = args.join(' ').trim();

    if (!text) {
      return message.reply({
        embeds: [createErrorEmbed('Pesan Kosong', `Pakai: \`${config.bot.prefix}dmall <pesan> [--role <@role>]\``)],
      });
    }
    if (text.length > 1800) {
      return message.reply({ embeds: [createErrorEmbed('Pesan Terlalu Panjang', 'Maksimal 1800 karakter.')] });
    }

    let role = null;
    if (roleToken) {
      const roleId = parseRoleId(roleToken);
      role = roleId ? message.guild.roles.cache.get(roleId) : null;
      if (!role) {
        return message.reply({ embeds: [createErrorEmbed('Role Tidak Ditemukan', 'Mention atau ID role tidak valid.')] });
      }
    }

    const members = await message.guild.members.fetch();
    const targets = [...members.values()].filter(
      (m) => !m.user.bot && (!role || m.roles.cache.has(role.id))
    );

    if (!targets.length) {
      return message.reply({ embeds: [createErrorEmbed('Tidak Ada Penerima', 'Tidak ada member yang cocok.')] });
    }

    const embed = buildDmEmbed(text, `Dikirim oleh staff ${message.guild.name}`);

    return runBulkDm({
      message,
      users: targets,
      embed,
      scopeText: role ? `member dengan role **${role.name}**` : 'member server ini',
      customKey: message.id,
    });
  },
};
