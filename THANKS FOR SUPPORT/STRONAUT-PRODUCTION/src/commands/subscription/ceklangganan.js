import { createSuccessEmbed, createWarningEmbed, createErrorEmbed } from '../../utils/embed.js';
import { getGuildSubscriptionStatus } from '../../utils/subscription.js';
import { config } from '../../config/config.js';

export default {
  name: 'ceklangganan',
  aliases: ['subscription', 'mysub', 'cekdonatur'],
  description: 'Cek status langganan server ini',
  usage: `${config.bot.prefix}ceklangganan`,
  example: `${config.bot.prefix}ceklangganan`,
  cooldown: 5,

  async execute(message) {
    if (!message.guild) {
      return message.reply({
        embeds: [createErrorEmbed('Khusus di Server', 'Command ini cuma bisa dipakai di dalam server Discord, bukan DM.')],
      });
    }

    const status = getGuildSubscriptionStatus(message.guild.id);

    if (!status) {
      return message.reply({
        embeds: [createWarningEmbed(
          'Belum Berlangganan',
          `Server ini belum punya langganan aktif (atau sudah expired).\n\n` +
          `Yuk berlangganan lewat \`${config.bot.prefix}bayar\`${config.dashboard.siteUrl ? ` atau di ${config.dashboard.siteUrl}/premium.html` : ''} — otomatis aktif setelah bayar QRIS.\n` +
          `Punya kode redeem? Klaim dengan \`${config.bot.prefix}redeem <kode>\`.`
        )],
      });
    }

    const durationText = status.expires_at
      ? `Aktif sampai <t:${Math.floor(new Date(status.expires_at).getTime() / 1000)}:F>`
      : 'Aktif **selamanya (Lifetime)** ♾️';

    await message.reply({
      embeds: [createSuccessEmbed(
        'Status Langganan Server Ini',
        `${durationText}\n\n` +
        `🏷️ **Sumber aktivasi:** \`${status.source || 'N/A'}\`\n` +
        `📅 **Aktif sejak:** ${status.activated_at}\n\n` +
        `Command khusus langganan: \`${config.bot.prefix}setmonitor\`, \`${config.bot.prefix}settextstatusall\`, \`${config.bot.prefix}loop\`, \`${config.bot.prefix}cfxfinder\`.\n` +
        `Berlaku untuk seluruh member di server ini.`
      )],
    });
  },
};
