import { PermissionsBitField } from 'discord.js';
import { createErrorEmbed, createSuccessEmbed, createWarningEmbed } from '../../utils/embed.js';
import { stopAllServersMonitor } from '../../services/monitor/allServersMonitorService.js';
import { getDb } from '../../database/db.js';
import { config } from '../../config/config.js';

// =======================================================
// Command: !stoptextstatusall
// Hentikan status gabungan "semua server" di sebuah text channel,
// pasangan dari !settextstatusall.
// =======================================================

export default {
  name: 'stoptextstatusall',
  aliases: ['untextstatusall', 'removetextstatusall', 'stopallstatus'],
  description: 'Hentikan status gabungan semua server pada sebuah text channel',
  usage: `${config.bot.prefix}stoptextstatusall <#text-channel>`,
  example: `${config.bot.prefix}stoptextstatusall #status`,
  cooldown: 5,

  async execute(message, args) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply({
        embeds: [createErrorEmbed('Akses Ditolak', 'Butuh permission **Manage Channels** untuk menghentikan status semua server.')],
      });
    }

    const channel =
      message.mentions.channels.first() ||
      (args[0] && await message.guild.channels.fetch(args[0].replace(/[<#>]/g, '')).catch(() => null));

    if (!channel) {
      return message.reply({
        embeds: [createErrorEmbed('Kurang Argumen', `**Penggunaan:** \`${config.bot.prefix}stoptextstatusall <#text-channel>\``)],
      });
    }

    const db = getDb();
    const monitor = db.prepare(`SELECT * FROM all_servers_monitors WHERE channel_id = ? AND is_active = 1`).get(channel.id);

    if (!monitor) {
      return message.reply({
        embeds: [createWarningEmbed('Tidak Ada Status Aktif', `${channel} tidak memiliki status semua server yang aktif.`)],
      });
    }

    stopAllServersMonitor(monitor.id);

    await message.reply({
      embeds: [createSuccessEmbed(
        'Status Semua Server Dihentikan',
        `✅ Status semua server di ${channel} telah dihentikan.\n\nPesan monitor tetap ada — hapus manual kalau tidak diperlukan lagi.`
      )],
    });
  },
};