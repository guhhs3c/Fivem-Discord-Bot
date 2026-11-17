import { EmbedBuilder } from 'discord.js';
import os from 'node:os';
import si from 'systeminformation';
import { config } from '../../config/config.js';

function formatBytes(bytes) {
  if (!bytes) return '0 GB';
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}h`); // hari
  if (h) parts.push(`${h}j`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

export default {
  name: 'ping',
  aliases: ['latency', 'pong', 'spek', 'specs'],
  description: 'Cek latency bot & spek hosting server',
  usage: `${config.bot.prefix}ping`,
  example: `${config.bot.prefix}ping`,
  cooldown: 5,

  async execute(message, args, client) {
    const sent = await message.reply({ content: '🏓 Pinging...' });
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const wsLatency = client.ws.ping;

    // Ambil data spek hosting. Kalau salah satu gagal (mis. tidak didukung OS),
    // jangan sampai bikin command error total.
    // LITE: si.cpu() & si.osInfo() menjalankan PowerShell/WMIC di Windows (lambat, +RAM).
    // Cukup pakai modul `os` untuk info statis; hanya load & mem yang murah dari systeminformation.
    const _cpus = os.cpus();
    const cpu = _cpus.length ? { manufacturer: '', brand: _cpus[0].model, cores: _cpus.length } : null;
    const osInfo = { distro: os.type(), release: os.release() };
    const [load, mem] = await Promise.all([
      si.currentLoad().catch(() => null),
      si.mem().catch(() => null),
    ]);

    const cpuLoad = load ? `${load.currentLoad.toFixed(1)}%` : 'N/A';
    const cpuModel = cpu ? `${cpu.manufacturer} ${cpu.brand}`.trim() : 'N/A';
    const cpuCores = cpu ? `${cpu.cores} cores` : 'N/A';

    const ramUsed = mem ? formatBytes(mem.active) : 'N/A';
    const ramTotal = mem ? formatBytes(mem.total) : 'N/A';
    const ramPercent = mem ? `${((mem.active / mem.total) * 100).toFixed(1)}%` : 'N/A';

    const platform = osInfo ? `${osInfo.distro} ${osInfo.release}` : `${os.platform()} ${os.release()}`;
    const uptime = formatUptime(os.uptime());

    const overallColor =
      latency < 100 ? config.colors.success : latency < 300 ? config.colors.warning : config.colors.danger;

    const embed = new EmbedBuilder()
      .setColor(overallColor)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: '📨 Message Latency', value: `\`${latency}ms\``, inline: true },
        { name: '🌐 WebSocket', value: `\`${wsLatency}ms\``, inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: '🖥️ CPU', value: `\`${cpuModel}\`\n\`${cpuCores} • ${cpuLoad} load\``, inline: false },
        { name: '💾 RAM', value: `\`${ramUsed} / ${ramTotal}\` (\`${ramPercent}\`)`, inline: true },
        { name: '🗂️ OS', value: `\`${platform}\``, inline: true },
        { name: '⏱️ Host Uptime', value: `\`${uptime}\``, inline: true },
      )
      .setFooter({ text: `${config.bot.name} • v${config.bot.version}` })
      .setTimestamp();

    await sent.edit({ content: null, embeds: [embed] });
  },
};