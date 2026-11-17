import { PermissionsBitField } from 'discord.js';
import { getServerStatus } from '../../services/fivem/serverService.js';
import { startMonitor } from '../../services/monitor/monitorService.js';
import { createMonitorEmbed, createErrorEmbed } from '../../utils/embed.js';
import { getDb } from '../../database/db.js';
import { config } from '../../config/config.js';

export default {
  name: 'setmonitor',
  premium: true,
  aliases: ['livemonitor', 'monitorserver'],
  description: 'Pasang live monitor server FiveM — 1 pesan auto-update di channel ini (bukan spam pesan baru)',
  usage: `${config.bot.prefix}setmonitor <server> [interval_detik]`,
  slashOptions: [
    { name: 'server', description: 'Nama/alias server FiveM', required: true },
    { name: 'interval_detik', description: 'Interval update dalam detik (opsional)', required: false },
  ],
  example: `${config.bot.prefix}setmonitor satumimpi 30`,
  cooldown: 10,

  async execute(message, args, client) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return message.reply({
        embeds: [createErrorEmbed('Akses Ditolak', 'Butuh permission **Manage Server** untuk memasang live monitor.')],
      });
    }

    if (!args[0]) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Kurang Argumen',
          `**Penggunaan:** \`${config.bot.prefix}setmonitor <server> [interval_detik]\`\n` +
          `**Contoh:** \`${config.bot.prefix}setmonitor satumimpi 30\`\n\n` +
          `Interval minimal: \`${config.loop.minInterval}s\` · Maksimal: \`${config.loop.maxInterval}s\`\n` +
          `Gunakan \`${config.bot.prefix}stopmonitor\` untuk menghentikan.`
        )],
      });
    }

    const serverInput = args[0];
    const intervalSec = args[1] && !isNaN(parseInt(args[1]))
      ? Math.min(config.loop.maxInterval, Math.max(config.loop.minInterval, parseInt(args[1])))
      : 30;

    const db = getDb();
    const existing = db.prepare(`SELECT * FROM monitors WHERE channel_id = ? AND is_active = 1`).get(message.channel.id);
    if (existing) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Monitor Sudah Aktif',
          `Channel ini sudah punya live monitor untuk **${existing.server_input}**.\n` +
          `Gunakan \`${config.bot.prefix}stopmonitor\` dulu sebelum pasang yang baru.`
        )],
      });
    }

    try {
      const status = await getServerStatus(serverInput);
      const embed = createMonitorEmbed(status, serverInput, intervalSec);

      // Pesan ini yang nanti akan terus di-edit — bukan dikirim ulang tiap update.
      const liveMessage = await message.channel.send({ embeds: [embed] });

      const result = db.prepare(
        `INSERT INTO monitors (guild_id, channel_id, message_id, server_input, interval_sec, is_active, created_by) VALUES (?, ?, ?, ?, ?, 1, ?)`
      ).run(message.guild.id, message.channel.id, liveMessage.id, serverInput, intervalSec, message.author.tag);

      startMonitor(client, {
        id: result.lastInsertRowid,
        channel_id: message.channel.id,
        message_id: liveMessage.id,
        server_input: serverInput,
        interval_sec: intervalSec,
      });

      await message.delete().catch(() => {});
    } catch (err) {
      await message.reply({ embeds: [createErrorEmbed('Gagal Memasang Monitor', err.message)] });
    }
  },
};
