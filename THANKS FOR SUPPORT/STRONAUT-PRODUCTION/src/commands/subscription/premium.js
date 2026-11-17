import { createErrorEmbed, createSuccessEmbed, createWarningEmbed } from '../../utils/embed.js';
import {
  activateGuildSubscription,
  getGuildSubscriptionStatus,
  revokeGuildSubscription,
  listActiveSubscriptions,
} from '../../utils/subscription.js';
import { config } from '../../config/config.js';
import { getDefaultPlan } from '../../utils/premiumPlans.js';

// =======================================================
// !premium — panel Owner untuk mengelola premium server
//   !premium give [guild_id] [hari]   (tanpa guild_id = server ini, hari 0 = lifetime)
//   !premium revoke [guild_id]
//   !premium info [guild_id]
//   !premium list
// =======================================================

const p = config.bot.prefix;

function fmtExpiry(sub) {
  return sub.expires_at
    ? `sampai <t:${Math.floor(new Date(sub.expires_at).getTime() / 1000)}:F>`
    : '**Lifetime** ♾️';
}

export default {
  name: 'premium',
  aliases: ['prem'],
  description: 'Kelola premium server (Owner only): give, revoke, info, list',
  usage: `${p}premium <give|revoke|info|list> [guild_id] [hari]`,
  slashOptions: [
    { name: 'aksi', description: 'give / revoke / info / list', required: true },
    { name: 'guild_id', description: 'ID server (kosong = server ini)', required: false },
    { name: 'hari', description: 'Durasi hari untuk give (0 = lifetime)', required: false },
  ],
  example: `${p}premium give 123456789012345678 30\n${p}premium give 30\n${p}premium list`,
  cooldown: 3,

  async execute(message, args, client) {
    if (message.author.id !== config.discord.ownerId) {
      return message.reply({ embeds: [createErrorEmbed('Akses Ditolak', 'Command ini hanya untuk Owner bot.')] });
    }

    const action = (args[0] || '').toLowerCase();
    const rest = args.slice(1);

    // Pisahkan guild_id (angka panjang) dan hari (angka pendek) dari sisa argumen.
    let guildId = rest.find((a) => /^\d{17,20}$/.test(a)) || null;
    const daysArg = rest.find((a) => /^\d{1,5}$/.test(a));
    if (!guildId) guildId = message.guild?.id || null;

    if (action === 'list') {
      const rows = listActiveSubscriptions();
      if (!rows.length) {
        return message.reply({ embeds: [createWarningEmbed('Premium Aktif', 'Belum ada server premium aktif.')] });
      }
      const lines = rows.slice(0, 25).map((r) => {
        const name = client?.guilds?.cache?.get(r.guild_id)?.name || 'tidak diketahui';
        const exp = r.expires_at ? `<t:${Math.floor(new Date(r.expires_at).getTime() / 1000)}:d>` : 'Lifetime';
        return `• **${name}** (\`${r.guild_id}\`) — ${exp}`;
      });
      return message.reply({
        embeds: [createSuccessEmbed(`Premium Aktif (${rows.length})`, lines.join('\n'))],
      });
    }

    if (!['give', 'revoke', 'info'].includes(action)) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Penggunaan',
          `\`${p}premium give [guild_id] [hari]\` — aktifkan (hari 0 = lifetime, default ${getDefaultPlan().days})\n` +
          `\`${p}premium revoke [guild_id]\` — cabut\n` +
          `\`${p}premium info [guild_id]\` — cek status\n` +
          `\`${p}premium list\` — daftar server premium\n\n` +
          `Tanpa \`guild_id\` = server tempat command dipakai.`
        )],
      });
    }

    if (!guildId) {
      return message.reply({ embeds: [createErrorEmbed('Guild ID Dibutuhkan', 'Pakai di server, atau sertakan guild_id (17–20 digit).')] });
    }

    const guildName = client?.guilds?.cache?.get(guildId)?.name || `ID ${guildId}`;

    if (action === 'info') {
      const sub = getGuildSubscriptionStatus(guildId);
      return message.reply({
        embeds: [sub
          ? createSuccessEmbed('Premium Aktif', `**${guildName}**\nAktif ${fmtExpiry(sub)}\nSumber: \`${sub.source || 'N/A'}\``)
          : createWarningEmbed('Tidak Premium', `**${guildName}** belum punya premium aktif.`)],
      });
    }

    if (action === 'revoke') {
      const done = revokeGuildSubscription(guildId);
      return message.reply({
        embeds: [done
          ? createSuccessEmbed('Premium Dicabut', `Premium **${guildName}** sudah dinonaktifkan.`)
          : createWarningEmbed('Tidak Ada', `**${guildName}** memang tidak punya premium aktif.`)],
      });
    }

    // give
    const days = daysArg !== undefined ? parseInt(daysArg, 10) : getDefaultPlan().days;
    const sub = activateGuildSubscription(guildId, days, `owner:${message.author.id}`);
    return message.reply({
      embeds: [createSuccessEmbed(
        'Premium Diaktifkan ✅',
        `**${guildName}** sekarang premium ${fmtExpiry(sub)}.\n` +
        `Fitur: \`${p}setmonitor\`, \`${p}settextstatusall\`, \`${p}loop\`, \`${p}cfxfinder\`.`
      )],
    });
  },
};
