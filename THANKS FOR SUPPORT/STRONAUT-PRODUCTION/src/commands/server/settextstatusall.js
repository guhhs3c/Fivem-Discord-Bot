import { PermissionsBitField, ChannelType } from 'discord.js';
import { startAllServersMonitor } from '../../services/monitor/allServersMonitorService.js';
import { createErrorEmbed, createSuccessEmbed, createAllServersMonitorEmbed } from '../../utils/embed.js';
import { getServerStatus } from '../../services/fivem/serverService.js';
import { getDb } from '../../database/db.js';
import { config } from '../../config/config.js';

// =======================================================
// Command: !settextstatusall
// Sama seperti !settextstatus, tapi 1 pesan ini menampilkan
// SEMUA server yang terdaftar di database sekaligus (bukan cuma 1),
// dan terus di-edit tiap interval.
// =======================================================

export default {
  name: 'settextstatusall',
  premium: true,
  aliases: ['textstatusall', 'setallstatus', 'monitorall'],
  description: 'Tampilkan status SEMUA server FiveM terdaftar di 1 pesan auto-update',
  usage: `${config.bot.prefix}settextstatusall <#text-channel> [interval_detik]`,
  example: `${config.bot.prefix}settextstatusall #status 60`,
  cooldown: 10,

  async execute(message, args, client) {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return message.reply({
        embeds: [createErrorEmbed('Akses Ditolak', 'Butuh permission **Manage Channels** untuk memasang status semua server.')],
      });
    }

    if (!args[0]) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Kurang Argumen',
          `**Penggunaan:** \`${config.bot.prefix}settextstatusall <#text-channel> [interval_detik]\`\n` +
          `**Contoh:** \`${config.bot.prefix}settextstatusall #status 60\`\n\n` +
          `Interval minimal: \`${config.loop.minInterval}s\` · Maksimal: \`${config.loop.maxInterval}s\`\n` +
          `Gunakan \`${config.bot.prefix}stoptextstatusall <#text-channel>\` untuk menghentikan.`
        )],
      });
    }

    const channel =
      message.mentions.channels.first() ||
      (await message.guild.channels.fetch(args[0].replace(/[<#>]/g, '')).catch(() => null));

    if (!channel || channel.type !== ChannelType.GuildText) {
      return message.reply({
        embeds: [createErrorEmbed('Channel Tidak Valid', 'Mention atau masukkan ID **text channel** yang valid.')],
      });
    }

    const botMember = await message.guild.members.fetchMe();
    const perms = channel.permissionsFor(botMember);
    if (!perms?.has(PermissionsBitField.Flags.ViewChannel) ||
        !perms?.has(PermissionsBitField.Flags.SendMessages) ||
        !perms?.has(PermissionsBitField.Flags.EmbedLinks)) {
      return message.reply({
        embeds: [createErrorEmbed('Izin Bot Kurang', `Bot butuh permission **View Channel**, **Send Messages**, dan **Embed Links** di ${channel}.`)],
      });
    }

    const intervalSec = args[1] && !isNaN(parseInt(args[1]))
      ? Math.min(config.loop.maxInterval, Math.max(config.loop.minInterval, parseInt(args[1])))
      : Math.max(60, config.loop.minInterval); // default agak lebih santai karena narik banyak server sekaligus

    const db = getDb();
    const existing = db.prepare(`SELECT * FROM all_servers_monitors WHERE channel_id = ? AND is_active = 1`).get(channel.id);
    if (existing) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Status Semua Server Sudah Aktif',
          `${channel} sudah dipasang status semua server.\n` +
          `Gunakan \`${config.bot.prefix}stoptextstatusall ${channel}\` dulu sebelum pasang ulang.`
        )],
      });
    }

    try {
      const rows = db.prepare(`SELECT * FROM servers WHERE is_active = 1 ORDER BY name ASC`).all();
      if (!rows.length) {
        return message.reply({
          embeds: [createErrorEmbed('Tidak Ada Server', 'Belum ada server di database.\nTambahkan server dulu dengan `setserver`.')],
        });
      }

      const results = await Promise.allSettled(
        rows.map((row) => getServerStatus((row.alias || '').split(',')[0]?.trim() || row.name))
      );
      const statuses = rows.map((row, i) => ({
        row,
        status: results[i].status === 'fulfilled' ? results[i].value : null,
      }));

      const embed = createAllServersMonitorEmbed(statuses, intervalSec);

      // Pesan ini yang nanti akan terus di-edit — bukan dikirim ulang tiap update.
      const liveMessage = await channel.send({ embeds: [embed] });

      const result = db.prepare(
        `INSERT INTO all_servers_monitors (guild_id, channel_id, message_id, interval_sec, is_active, created_by)
         VALUES (?, ?, ?, ?, 1, ?)`
      ).run(message.guild.id, channel.id, liveMessage.id, intervalSec, message.author.tag);

      startAllServersMonitor(client, {
        id: result.lastInsertRowid,
        channel_id: channel.id,
        message_id: liveMessage.id,
        interval_sec: intervalSec,
      });

      await message.reply({
        embeds: [createSuccessEmbed(
          'Status Semua Server Terpasang',
          `✅ ${channel} sekarang menampilkan status **${rows.length} server** dan auto-update tiap **${intervalSec}s**.`
        )],
      });
    } catch (err) {
      await message.reply({ embeds: [createErrorEmbed('Gagal Memasang Status Semua Server', err.message)] });
    }
  },
};