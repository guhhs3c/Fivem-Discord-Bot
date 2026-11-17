import { EmbedBuilder } from 'discord.js';
import { getDb } from '../../database/db.js';
import { createErrorEmbed, createLoadingEmbed, SEPARATOR } from '../../utils/embed.js';
import { runDdosCheck } from '../../services/monitor/ddosDetectionService.js';
import { config } from '../../config/config.js';

const SEVERITY_ORDER = { critical: 0, warning: 1, ok: 2 };

export default {
  name: 'ddoscheckall',
  premium: true,
  aliases: ['ddosall', 'cekddosall'],
  description: 'Cek indikasi DDoS/gangguan untuk SEMUA server aktif di database (heuristik)',
  usage: `${config.bot.prefix}ddoscheckall`,
  example: `${config.bot.prefix}ddoscheckall`,
  cooldown: 30,

  async execute(message) {
    const db = getDb();
    const servers = db.prepare(`SELECT * FROM servers WHERE is_active = 1 ORDER BY name ASC`).all();

    if (!servers.length) {
      return message.reply({
        embeds: [createErrorEmbed('Tidak Ada Server', 'Belum ada server di database.\nGunakan `setserver` untuk menambahkan.')],
      });
    }

    const loadingMsg = await message.reply({
      embeds: [createLoadingEmbed(`Mengecek ${servers.length} server terdaftar, ini bisa makan waktu beberapa detik...`)],
    });

    // Konkurensi dibatasi 3 server sekaligus (tiap server cuma beberapa GET ringan).
    const checked = new Array(servers.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < servers.length) {
        const idx = cursor++;
        const row = servers[idx];
        const input = (row.alias || '').split(',')[0]?.trim() || row.name || row.endpoint || row.cfx_code;
        try {
          // Sampel lebih sedikit per server biar total waktu cek-semua gak kelamaan.
          const r = await runDdosCheck(input, { samples: 3, intervalMs: 600 });
          checked[idx] = { row, r };
        } catch (err) {
          checked[idx] = {
            row,
            r: { severity: 'critical', riskScore: 100, label: '🔴 Error', flags: [err.message], successRate: 0, samples: 0, avgLatency: null },
          };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, servers.length) }, worker));

    checked.sort((a, b) =>
      (SEVERITY_ORDER[a.r.severity] ?? 3) - (SEVERITY_ORDER[b.r.severity] ?? 3) ||
      (b.r.riskScore ?? 0) - (a.r.riskScore ?? 0)
    );

    let lines = checked.map(({ row, r }) => {
      const name = row.name || 'Server';
      const latencyPart = r.avgLatency != null ? ` • \`${r.avgLatency}ms\`` : '';
      const lossPart = typeof r.successRate === 'number' ? ` • loss \`${Math.round((1 - r.successRate) * 100)}%\`` : '';
      const scorePart = typeof r.riskScore === 'number' ? ` • skor \`${r.riskScore}\`` : '';
      const note = r.severity !== 'ok' && r.flags?.[0] ? `\n   ↳ ${r.flags[0]}` : '';
      return `${r.label || '❓'} **${name}**${latencyPart}${lossPart}${scorePart}${note}`;
    });

    // Batas deskripsi embed Discord = 4096 karakter.
    let budget = 3300;
    const kept = [];
    for (const l of lines) {
      if (budget - l.length < 0) break;
      kept.push(l);
      budget -= l.length + 1;
    }
    const hidden = lines.length - kept.length;
    lines = hidden > 0 ? [...kept, `… dan **${hidden}** server lain (semuanya dalam kondisi lebih baik).`] : kept;

    const anomalyCount = checked.filter(({ r }) => r.severity !== 'ok').length;

    const embed = new EmbedBuilder()
      .setColor(anomalyCount > 0 ? config.colors.warning : config.colors.success)
      .setAuthor({ name: '🛰️ DDoS / Anomaly Check — Semua Server' })
      .setDescription(
        `${SEPARATOR}\n\n${lines.join('\n')}\n\n${SEPARATOR}\n\n` +
        `**${anomalyCount}/${checked.length}** server dengan indikasi anomali.\n` +
        `> ℹ️ Heuristik dari packet loss & latency beberapa sampel ping — bukan konfirmasi pasti DDoS. ` +
        `Pakai \`${config.bot.prefix}ddoscheck <server>\` untuk detail per-server.`
      )
      .setFooter({ text: `${config.bot.name} • v${config.bot.version}` })
      .setTimestamp();

    await loadingMsg.edit({ embeds: [embed], components: [] });
  },
};
