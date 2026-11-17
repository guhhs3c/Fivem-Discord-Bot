import { PermissionsBitField } from 'discord.js';
import { createErrorEmbed, createSuccessEmbed, createWarningEmbed } from '../../utils/embed.js';
import { stopMonitor } from '../../services/monitor/monitorService.js';
import { getDb } from '../../database/db.js';
import { config } from '../../config/config.js';

export default {
  name: 'stopmonitor',
  aliases: ['unmonitor', 'removemonitor'],
  description: 'Hentikan live monitor server di channel ini',
  usage: `${config.bot.prefix}stopmonitor`,
  example: `${config.bot.prefix}stopmonitor`,
  cooldown: 5,

  async execute(message) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return message.reply({
        embeds: [createErrorEmbed('Akses Ditolak', 'Butuh permission **Manage Server** untuk menghentikan live monitor.')],
      });
    }

    const db = getDb();
    const monitor = db.prepare(`SELECT * FROM monitors WHERE channel_id = ? AND is_active = 1`).get(message.channel.id);

    if (!monitor) {
      return message.reply({
        embeds: [createWarningEmbed('Tidak Ada Monitor', 'Channel ini tidak memiliki live monitor yang aktif.')],
      });
    }

    stopMonitor(monitor.id);

    await message.reply({
      embeds: [createSuccessEmbed('Monitor Dihentikan', `✅ Live monitor untuk **${monitor.server_input}** telah dihentikan.\n\nPesan monitor tetap ada — hapus manual kalau tidak diperlukan lagi.`)],
    });
  },
};
