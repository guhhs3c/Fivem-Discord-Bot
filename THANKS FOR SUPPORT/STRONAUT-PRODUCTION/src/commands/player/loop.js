import { findPlayerByName } from '../../services/fivem/playerService.js';
import { createPlayerResultEmbed, createPlayerNotFoundEmbed, createErrorEmbed, createLoadingEmbed, createSuccessEmbed, createWarningEmbed } from '../../utils/embed.js';
import { getDb } from '../../database/db.js';
import { config } from '../../config/config.js';

const activeLoops = new Map();

export function getActiveLoops() {
  return activeLoops;
}

export default {
  name: 'loop',
  premium: true,
  aliases: ['monitor', 'track'],
  description: 'Auto monitoring player di FiveM server',
  usage: `${config.bot.prefix}loop <server> <nama> [detik]`,
  slashOptions: [
    { name: 'server', description: 'Nama/alias server FiveM', required: true },
    { name: 'nama', description: 'Nama player yang mau dimonitor', required: true },
    { name: 'detik', description: 'Interval cek dalam detik (opsional)', required: false },
  ],
  example: `${config.bot.prefix}loop satumimpi budi 60`,
  cooldown: 5,

  async execute(message, args) {
    if (args.length < 2) {
      return message.reply({
        embeds: [createErrorEmbed(
          'Kurang Argumen',
          `**Penggunaan:** \`${config.bot.prefix}loop <server> <nama> [detik]\`\n` +
          `**Contoh:** \`${config.bot.prefix}loop satumimpi budi 60\`\n\n` +
          `Interval minimal: \`${config.loop.minInterval}s\` · Maksimal: \`${config.loop.maxInterval}s\``
        )],
      });
    }

    const userId = message.author.id;
    const serverInput = args[0];
    const nama = args.slice(1, args.length - 1).join(' ') || args[1];
    const lastArg = args[args.length - 1];
    const intervalSec = !isNaN(parseInt(lastArg)) && args.length > 2
      ? Math.min(config.loop.maxInterval, Math.max(config.loop.minInterval, parseInt(lastArg)))
      : 60;
    const targetName = args.length > 2 && !isNaN(parseInt(lastArg)) ? args.slice(1, -1).join(' ') : args.slice(1).join(' ');

    if (activeLoops.has(userId)) {
      return message.reply({
        embeds: [createWarningEmbed(
          'Loop Sudah Aktif',
          `Kamu sudah punya monitoring aktif.\nGunakan \`${config.bot.prefix}stoploop\` untuk menghentikannya terlebih dahulu.`
        )],
      });
    }

    const loadingMsg = await message.reply({
      embeds: [createLoadingEmbed(`Memulai monitoring **${targetName}** di **${serverInput}** setiap \`${intervalSec}s\`...`)],
    });

    try {
      // Initial check
      const { found, serverData, endpoint, dbRow } = await findPlayerByName(serverInput, targetName);
      const hostname = serverData?.Data?.hostname?.replace(/\^[0-9]/g, '').trim() || serverInput;
      const bannerUrl = dbRow?.banner_url || null;

      await loadingMsg.edit({
        embeds: [createSuccessEmbed(
          'Monitoring Dimulai',
          `✅ Monitoring **${targetName}** di **${hostname}**\n` +
          `⏱️ Interval: setiap \`${intervalSec} detik\`\n\n` +
          `Kamu akan di-ping saat player ditemukan.\nHentikan dengan \`${config.bot.prefix}stoploop\``
        )],
        components: [],
      });

      try {
        getDb().prepare(
          `INSERT INTO loopfinder (discord_id, server_input, target_name, interval_sec, channel_id, is_active) VALUES (?, ?, ?, ?, ?, 1)`
        ).run(userId, serverInput, targetName, intervalSec, message.channel.id);
      } catch {}

      const timer = setInterval(async () => {
        try {
          const result = await findPlayerByName(serverInput, targetName);
          const hn = result.serverData?.Data?.hostname?.replace(/\^[0-9]/g, '').trim() || serverInput;
          if (result.found.length > 0) {
            const embed = createPlayerResultEmbed(result.found, targetName, hn, result.endpoint, result.dbRow?.banner_url || null);
            embed.setTitle(`🔔 Player Ditemukan!`);

            await message.channel.send({ content: `<@${userId}> Player **${targetName}** ditemukan!`, embeds: [embed] });
            clearInterval(timer);
            activeLoops.delete(userId);
            try { getDb().prepare(`UPDATE loopfinder SET is_active = 0 WHERE discord_id = ?`).run(userId); } catch {}
          }
        } catch (err) {
          // Silent error in loop
        }
      }, intervalSec * 1000);

      activeLoops.set(userId, timer);
    } catch (err) {
      await loadingMsg.edit({
        embeds: [createErrorEmbed('Gagal Memulai Monitoring', `❌ ${err.message}`)],
        components: [],
      });
    }
  },
};
