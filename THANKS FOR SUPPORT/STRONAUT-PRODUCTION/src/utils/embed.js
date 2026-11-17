import { EmbedBuilder } from 'discord.js';
import { config } from '../config/config.js';

export const SEPARATOR = '─────────────────────────────';

/**
 * Privasi: sembunyikan endpoint (IP:PORT) server di semua embed umum.
 * Endpoint asli HANYA ditampilkan lewat command !cfxfinder (donatur),
 * yang membangun embed-nya sendiri secara terpisah dari file ini.
 */
export function maskEndpoint() {
  return '🔒 Private';
}

export function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(config.colors.danger)
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setFooter({ text: `${config.bot.name} • v${config.bot.version}` })
    .setTimestamp();
}

export function createSuccessEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(config.colors.success)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setFooter({ text: `${config.bot.name} • v${config.bot.version}` })
    .setTimestamp();
}

export function createWarningEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(config.colors.warning)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setFooter({ text: `${config.bot.name} • v${config.bot.version}` })
    .setTimestamp();
}

export function createLoadingEmbed(text) {
  return new EmbedBuilder()
    .setColor(config.colors.info)
    .setDescription(`⏳ ${text}`)
    .setFooter({ text: `${config.bot.name} • Memuat...` });
}

/**
 * Single minimalist embed for !player command.
 * Shows up to 5 players in one compact, clean embed.
 */
export function createPlayerResultEmbed(found, nama, hostname, endpoint, bannerUrl) {
  const isSingle = found.length === 1;
  const p = found[0];

  if (isSingle) {
    // Single player — focused, clean card
    const pingBar = buildPingBar(p.ping);
    const identifiers = (p.identifiers || [])
      .filter(id => id.startsWith('license:') || id.startsWith('steam:') || id.startsWith('discord:'))
      .map(id => `\`${id.substring(0, 40)}\``)
      .slice(0, 2)
      .join('\n') || '`—`';

    return new EmbedBuilder()
      .setColor(config.colors.success)
      .setAuthor({ name: `🎮 ${hostname}`, iconURL: null })
      .setTitle(`👤 ${p.name}`)
      .setDescription(
        `> **Server ID:** \`${p.id}\`\n` +
        `> **Ping:** ${pingBar} \`${p.ping ?? '?'}ms\`\n` +
        `> **Connect:** \`${maskEndpoint()}\``
      )
      .addFields(
        { name: '🔑 Identifiers', value: identifiers, inline: false }
      )
      .setFooter({ text: `${config.bot.name} • v${config.bot.version}` })
      .setTimestamp()
      .setImage(bannerUrl || null);
  }

  // Multiple players — compact list
  const lines = found.slice(0, 1000).map((pl, i) => {
    const ping = pl.ping ?? '?';
    const pingEmoji = ping === '?' ? '❓' : ping < 80 ? '🟢' : ping < 150 ? '🟡' : '🔴';
    return `**${i + 1}.** \`${pl.name}\` — ID \`${pl.id}\` ${pingEmoji} \`${ping}ms\``;
  });

  return new EmbedBuilder()
    .setColor(config.colors.success)
    .setAuthor({ name: `🎮 ${hostname}` })
    .setTitle(`🔍 ${found.length} Player Ditemukan`)
    .setDescription(lines.join('\n'))
    .addFields(
      { name: '🌐 Server', value: `\`${hostname}\``, inline: true },
      { name: '🔗 Endpoint', value: `\`${maskEndpoint()}\``, inline: true },
    )
    .setFooter({ text: `${config.bot.name} • v${config.bot.version} • Hasil pencarian "${found[0]?.name?.split(' ')[0] ?? ''}"` })
    .setTimestamp()
    .setImage(bannerUrl || null);
}

export function createPlayerFoundEmbed(player, hostname, endpoint, bannerUrl) {
  const pingBar = buildPingBar(player.ping);
  const identifiers = (player.identifiers || [])
    .filter(id => id.startsWith('license:') || id.startsWith('steam:') || id.startsWith('discord:'))
    .map(id => `\`${id.substring(0, 48)}\``)
    .slice(0, 3)
    .join('\n') || '`—`';

  return new EmbedBuilder()
    .setColor(config.colors.success)
    .setAuthor({ name: `🎮 ${hostname}` })
    .setTitle(`👤 ${player.name}`)
    .setDescription(
      `**ID:** \`${player.id}\` · **Ping:** ${pingBar} \`${player.ping ?? '?'}ms\`\n` +
      `**Server:** \`${maskEndpoint()}\``
    )
    .addFields({ name: '🔑 Identifiers', value: identifiers })
    .setFooter({ text: `${config.bot.name} • v${config.bot.version}` })
    .setTimestamp()
    .setImage(bannerUrl || null);
}

export function createPlayerNotFoundEmbed(nama, hostname) {
  return new EmbedBuilder()
    .setColor(config.colors.warning)
    .setTitle(`🔍 Player Tidak Ditemukan`)
    .setDescription(
      `Tidak ada player bernama **${nama}** di server **${hostname}**.\n\n` +
      `> 💡 Coba nama lain atau cek \`!allplayer\` untuk daftar lengkap.`
    )
    .setFooter({ text: `${config.bot.name} • v${config.bot.version}` })
    .setTimestamp();
}

export function createServerEmbed(serverData, serverInput, status, bannerUrl) {
  const Data = serverData?.Data || {};
  const vars = Data.vars || {};
  const filled = status.maxPlayers > 0
    ? Math.min(10, Math.round((status.playerCount / status.maxPlayers) * 10))
    : 0;
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

  return new EmbedBuilder()
    .setColor(config.colors.success)
    .setTitle(`🟢 ${status.hostname}`)
    .setDescription(`${SEPARATOR}`)
    .addFields(
      { name: `👥 Players`, value: `\`${status.playerCount}/${status.maxPlayers}\` \`${bar}\``, inline: false },
      { name: '🎮 Gametype', value: `\`${vars.gametype || 'N/A'}\``, inline: true },
      { name: '🗺️ Map', value: `\`${vars.mapname || 'N/A'}\``, inline: true },
      { name: '🔗 Connect', value: `\`connect ${maskEndpoint()}\``, inline: false },
    )
    .setFooter({ text: `${config.bot.name} • v${config.bot.version}` })
    .setTimestamp()
    .setImage(bannerUrl || null);
}

export function createServerOfflineEmbed(serverInput, error) {
  return new EmbedBuilder()
    .setColor(config.colors.danger)
    .setTitle('🔴 Server Offline')
    .setDescription(
      `Server **${serverInput}** sedang offline atau tidak dapat dijangkau.\n\n` +
      (error ? `> \`${error}\`` : '')
    )
    .setFooter({ text: `${config.bot.name} • v${config.bot.version}` })
    .setTimestamp();
}

/**
 * Modern "live" embed for the auto-editing monitor message.
 * Redesigned with a cleaner card-like layout: big player count,
 * chip-style inline fields, and a relative-time footer.
 */
export function createMonitorEmbed(status, serverInput, intervalSec) {
  const bannerUrl = status.dbRow?.banner_url || null;
  const nowTs = Math.floor(Date.now() / 1000);

  if (!status.online) {
    return new EmbedBuilder()
      .setColor(config.colors.danger)
      .setAuthor({ name: '🔴 LIVE MONITOR — OFFLINE' })
      .setTitle(status.hostname || serverInput)
      .setDescription(
        `${SEPARATOR}\n\n` +
        `> ⚠️ Server sedang **tidak bisa dijangkau**.\n` +
        (status.error ? `> \`${status.error}\`\n` : '') +
        `\n${SEPARATOR}`
      )
      .setFooter({ text: `${config.bot.name} • Auto-update tiap ${intervalSec}s` })
      .setTimestamp();
  }

  const vars = status.sv?.vars || {};
  const filled = status.maxPlayers > 0
    ? Math.min(12, Math.round((status.playerCount / status.maxPlayers) * 12))
    : 0;
  const bar = '🟩'.repeat(filled) + '⬛'.repeat(12 - filled);

  const embed = new EmbedBuilder()
    .setColor(config.colors.success)
    .setAuthor({ name: '🟢 LIVE MONITOR' })
    .setTitle(status.hostname)
    .setDescription(
      `${SEPARATOR}\n\n` +
      `**${status.playerCount} / ${status.maxPlayers}** players online\n` +
      `${bar}\n\n` +
      `${SEPARATOR}`
    )
    .addFields(
      { name: '🎮 Mode', value: `\`${vars.gametype || 'N/A'}\``, inline: true },
      { name: '🗺️ Map', value: `\`${vars.mapname || 'N/A'}\``, inline: true },
      { name: '🔄 OneSync', value: status.oneSync ? '✅ Aktif' : '❌ Off', inline: true },
      { name: '🔗 Connect', value: `\`connect ${maskEndpoint()}\``, inline: false },
    )
    .setFooter({ text: `${config.bot.name} • Auto-update tiap ${intervalSec}s • Terakhir diupdate` })
    .setTimestamp();

  if (bannerUrl) embed.setImage(bannerUrl);
  return embed;
}

/**
 * Modern embed for bot guild join/leave notifications.
 */
export function createGuildEventEmbed(guild, type, totalGuilds) {
  const isJoin = type === 'join';
  const iconUrl = typeof guild.iconURL === 'function' ? guild.iconURL({ size: 256 }) : null;

  return new EmbedBuilder()
    .setColor(isJoin ? config.colors.success : config.colors.danger)
    .setAuthor({ name: isJoin ? '📥 Bergabung ke Server Baru' : '📤 Keluar dari Server', iconURL: iconUrl || undefined })
    .setTitle(guild.name)
    .setThumbnail(iconUrl || null)
    .setDescription(
      `${SEPARATOR}\n\n` +
      `👥 **Members:** \`${guild.memberCount?.toLocaleString?.() || 'N/A'}\`\n` +
      `👑 **Owner:** ${guild.ownerId ? `<@${guild.ownerId}>` : 'N/A'}\n` +
      `🆔 **Guild ID:** \`${guild.id}\`\n\n` +
      `${SEPARATOR}`
    )
    .setFooter({ text: `${config.bot.name} • Total ${totalGuilds} server sekarang` })
    .setTimestamp();
}

/**
 * Embed gabungan untuk !settextstatusall — nampilin status SEMUA server
 * terdaftar dalam 1 pesan yang auto-update, bukan 1 pesan per server.
 * statuses: array of { row, status } — row = record dari tabel `servers`,
 * status = hasil getServerStatus() untuk server itu (bisa null kalau fetch gagal total).
 */
export function createAllServersMonitorEmbed(statuses, intervalSec) {
  const totalOnline = statuses.filter((s) => s.status?.online).length;
  const totalPlayers = statuses.reduce((sum, s) => sum + (s.status?.online ? s.status.playerCount : 0), 0);

  const lines = statuses.length
    ? statuses.map(({ row, status }) => {
        const name = row.name || 'Server';
        if (!status || !status.online) {
          return `🔴 **${name}** — Offline`;
        }
        return `🟢 **${name}** — \`${status.playerCount}/${status.maxPlayers}\` players`;
      })
    : ['Belum ada server terdaftar. Gunakan `setserver` untuk menambahkan.'];

  return new EmbedBuilder()
    .setColor(totalOnline > 0 ? config.colors.success : config.colors.danger)
    .setAuthor({ name: '📡 LIVE STATUS — SEMUA SERVER' })
    .setDescription(
      `${SEPARATOR}\n\n` +
      lines.join('\n') +
      `\n\n${SEPARATOR}\n\n` +
      `**${totalOnline}/${statuses.length}** server online • **${totalPlayers}** total player`
    )
    .setFooter({ text: `${config.bot.name} • Auto-update tiap ${intervalSec}s • Terakhir diupdate` })
    .setTimestamp();
}

/**
 * Embed hasil !ddoscheck — heuristik packet loss/latency/jitter dari
 * beberapa sampel ping ringan. Selalu disertai disclaimer karena ini
 * indikasi, bukan konfirmasi pasti server sedang diserang DDoS.
 */
export function createDdosCheckEmbed(result, serverInput) {
  const color = result.severity === 'critical'
    ? config.colors.danger
    : result.severity === 'warning'
      ? config.colors.warning
      : config.colors.success;

  const cut = (t, n = 1024) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
  const ms = (v) => (v == null ? '-' : `${v}ms`);
  const pct = (r) => `${Math.round(r * 100)}%`;

  const score = result.riskScore ?? 0;
  const filled = Math.round(score / 10);
  const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);

  const errText = (errors) => {
    const e = Object.entries(errors || {});
    return e.length ? e.map(([k, v]) => `${k}×${v}`).join(', ') : 'tidak ada';
  };

  const layerText = (l, title) => {
    if (!l?.used) return `⏭️ Dilewati — ${l?.reason || 'tidak tersedia'}`;
    return (
      `Sukses: \`${l.ok}/${l.total}\` (${pct(l.successRate)})\n` +
      `Latency: avg \`${ms(l.avg)}\` • p50 \`${ms(l.p50)}\` • p95 \`${ms(l.p95)}\`\n` +
      `Min/Max: \`${ms(l.min)}\` / \`${ms(l.max)}\` • Jitter \`${ms(l.jitter)}\`\n` +
      `Error: ${errText(l.errors)}`
    );
  };

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: '🛰️ DDoS / Connection Anomaly Check' })
    .setTitle(`${result.label} — ${result.hostname || serverInput}`)
    .setDescription(
      `**Skor Gangguan:** \`${score}/100\` ${bar}\n` +
      `**Sampel:** \`${result.samples}\` • interval \`${result.intervalMs}ms\` • mode \`${result.mode === 'cfx' ? 'CFX code + probe langsung' : 'direct'}\`` +
      (result.cached ? `\n> ♻️ Hasil dari cek ${result.cacheAgeSec}s lalu (cooldown anti-spam ke server target).` : '')
    )
    .addFields(
      { name: '🔌 Server (probe langsung)', value: cut(layerText(result.layers?.direct)), inline: false },
    );

  if (result.layers?.cfx?.used) {
    embed.addFields({ name: '☁️ CFX API', value: cut(layerText(result.layers.cfx)), inline: false });
  }

  // Timeline sampel (maks 10 baris)
  if (result.timeline?.length) {
    const cell = (c) => (c ? (c.ok ? `✅ ${c.ms}ms` : `❌ ${c.err}`) : '—');
    const hasCfx = result.layers?.cfx?.used;
    const rows = result.timeline.map((t, i) =>
      `${String(i + 1).padStart(2)}  ${cell(t.direct).padEnd(16)}${hasCfx ? cell(t.cfx) : ''}`.trimEnd()
    );
    const head = `#   ${'Server'.padEnd(16)}${hasCfx ? 'CFX API' : ''}`.trimEnd();
    embed.addFields({ name: '📊 Timeline Sampel', value: cut('```\n' + head + '\n' + rows.join('\n') + '\n```'), inline: false });
  }

  // Player & baseline
  const playerLines = [];
  if (result.currentPlayerCount != null) {
    playerLines.push(`👥 Player: \`${result.currentPlayerCount}${result.maxPlayers ? `/${result.maxPlayers}` : ''}\``);
  }
  if (result.playerDropPct != null) {
    playerLines.push(result.playerDropPct > 0
      ? `📉 Turun \`${result.playerDropPct}%\` dari cek sebelumnya`
      : `📈 Naik \`${Math.abs(result.playerDropPct)}%\` dari cek sebelumnya`);
  }
  if (result.baseline) {
    playerLines.push(`📐 Baseline latency: \`${result.baseline.medianLatency}ms\` (${result.baseline.n} cek terakhir)`);
  } else {
    playerLines.push('📐 Baseline: belum cukup riwayat (butuh ≥3 cek sebelumnya)');
  }
  embed.addFields({ name: '📈 Konteks', value: cut(playerLines.join('\n')), inline: false });

  embed.addFields({
    name: '🧠 Temuan',
    value: cut(result.flags?.length ? result.flags.map((f) => `• ${f}`).join('\n') : '• Tidak ada anomali terdeteksi dari sampel ini.'),
    inline: false,
  });

  if (result.causes?.length) {
    embed.addFields({ name: '🔎 Kemungkinan Penyebab', value: cut(result.causes.map((c) => `• ${c}`).join('\n')), inline: false });
  }
  if (result.recommendations?.length) {
    embed.addFields({ name: '🛠️ Saran', value: cut(result.recommendations.map((c) => `• ${c}`).join('\n')), inline: false });
  }

  return embed
    .setFooter({ text: `${config.bot.name} • v${config.bot.version} • Heuristik probe HTTP/TCP — tidak melihat trafik UDP game, bukan konfirmasi pasti DDoS` })
    .setTimestamp(result.checkedAt || Date.now());
}

function buildPingBar(ping) {
  if (ping === undefined || ping === null) return '⬜⬜⬜⬜⬜';
  if (ping < 50) return '🟩🟩🟩🟩🟩';
  if (ping < 100) return '🟩🟩🟩🟩⬜';
  if (ping < 150) return '🟨🟨🟨⬜⬜';
  if (ping < 250) return '🟧🟧⬜⬜⬜';
  return '🟥⬜⬜⬜⬜';
}