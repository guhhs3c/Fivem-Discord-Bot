import { createErrorEmbed, createSuccessEmbed } from '../../utils/embed.js';
import { PermissionsBitField } from 'discord.js';
import { redeemCodeForGuild } from '../../utils/subscription.js';
import { config } from '../../config/config.js';

export default {
  name: 'redeem',
  aliases: ['klaim'],
  description: 'Klaim kode langganan untuk server ini',
  usage: `${config.bot.prefix}redeem <kode>`,
  slashOptions: [
    { name: 'kode', description: 'Kode redeem dari Owner/Support', required: true },
  ],
  example: `${config.bot.prefix}redeem STRO-AB12-CD34`,
  cooldown: 5,

  async execute(message, args) {
    if (!message.guild) {
      return message.reply({
        embeds: [createErrorEmbed('Khusus di Server', 'Command ini cuma bisa dipakai di dalam server Discord, bukan DM.')],
      });
    }

    if (!args[0]) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Kurang Argumen',
          `**Penggunaan:** \`${config.bot.prefix}redeem <kode>\`\n` +
          `**Contoh:** \`${config.bot.prefix}redeem STRO-AB12-CD34\`\n\n` +
          `Belum punya kode? Berlangganan dulu lewat \`${config.bot.prefix}bayar\`.`
        )],
      });
    }

    // Hanya admin server yang boleh klaim, supaya kode tidak "nyasar" ke server yang salah.
    const isAdmin =
      message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
      message.author.id === config.discord.ownerId;
    if (!isAdmin) {
      return message.reply({
        embeds: [createErrorEmbed('Akses Ditolak', 'Butuh permission **Manage Server** untuk mengklaim kode premium.')],
      });
    }

    // Hapus pesan yang berisi kode (prefix command) biar tidak dilihat/disalin orang lain.
    if (!message.isSlash) message.delete?.().catch(() => {});

    const result = redeemCodeForGuild(message.guild.id, message.author.id, args[0]);
    if (!result.ok) {
      return message.reply({ embeds: [createErrorEmbed('Redeem Gagal', result.message)] });
    }
    const sub = result.sub;

    const durationText = sub.expires_at
      ? `sampai <t:${Math.floor(new Date(sub.expires_at).getTime() / 1000)}:F>`
      : '**selamanya (Lifetime)** ♾️';

    await message.reply({
      embeds: [createSuccessEmbed(
        'Kode Berhasil Diklaim! 🎉',
        `Subscription untuk **${message.guild.name}** sekarang aktif.\n\n` +
        `⏳ **Status:** Aktif ${durationText}\n\n` +
        `Sekarang seluruh member di server ini bisa pakai command khusus langganan:\n` +
        `\`${config.bot.prefix}setmonitor\`, \`${config.bot.prefix}settextstatusall\`, \`${config.bot.prefix}loop\`, \`${config.bot.prefix}cfxfinder\`\n\n` +
        `Cek status kapan aja dengan \`${config.bot.prefix}ceklangganan\`. Terima kasih sudah mendukung! 🙏`
      )],
    });
  },
};
