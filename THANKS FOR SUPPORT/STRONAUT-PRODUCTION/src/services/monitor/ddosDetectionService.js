import axios from 'axios';
import {
  resolveEndpoint,
  isCfxCode,
  normalizeDirectAddress,
  FIVEM_API_HEADERS,
} from '../fivem/serverService.js';
import { config } from '../../config/config.js';

// =============================================================================
// DDoS / Connection Anomaly Check — CEK PASIF (read-only), bukan stress test.
//
// Cara kerja (2 layer, dibandingkan satu sama lain):
//   1. Layer CFX API    : status server menurut API publik CFX (pihak ketiga).
//   2. Layer Direct     : probe langsung ke /info.json server (origin / proxy
//                         CFX), alamatnya ditemukan otomatis dari connectEndPoints.
// Membandingkan keduanya membedakan "server-nya bermasalah" vs "API CFX yang
// bermasalah" — hal yang tidak bisa dilakukan versi lama (yang cuma ping CFX API).
//
// BATAS KERAS (tidak bisa dilonggarkan caller) supaya tidak bisa jadi flooder:
//   - max 10 sampel, interval minimal 300ms
//   - tiap sampel = 1 GET ringan per layer
//   - cooldown per-target (hasil di-cache), jadi spam command dari banyak user
//     tidak menghasilkan traffic tambahan ke server target.
// =============================================================================

const MAX_SAMPLES = 10;
const MIN_INTERVAL_MS = 300;
const MAX_INTERVAL_MS = 5000;

const HISTORY_MAX = 20;
const HISTORY_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 jam
const MAX_CONTENT = 5 * 1024 * 1024;

// key target -> [{ ts, avgLatency, successRate, players }]
const history = new Map();
// key target -> { ts, result } (cooldown / anti-spam)
const recentRuns = new Map();
// key target -> base URL direct terakhir yang berhasil ditemukan
const directBaseMemo = new Map();

// ─── Util statistik ──────────────────────────────────────────────────────────
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const stdDev = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((v) => (v - m) ** 2)));
};
function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}
const median = (a) => percentile([...a].sort((x, y) => x - y), 50);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── HTTP probe + klasifikasi error ──────────────────────────────────────────
function classifyError(err) {
  if (err?.response) return `HTTP ${err.response.status}`;
  const code = err?.code;
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(err?.message || '')) return 'timeout';
  if (code) return code;
  return 'error';
}

async function timedGet(url, timeout) {
  const t0 = Date.now();
  try {
    const res = await axios.get(url, {
      timeout,
      headers: FIVEM_API_HEADERS,
      maxContentLength: MAX_CONTENT,
      maxBodyLength: MAX_CONTENT,
    });
    return { ok: true, ms: Date.now() - t0, data: res.data };
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, err: classifyError(err) };
  }
}

function extractCfxCode(endpoint) {
  return String(endpoint)
    .replace(/.*cfx\.re\/join\//i, '')
    .replace(/.*fivem\.net.*\/join\//i, '')
    .replace(/\/$/, '')
    .trim();
}

async function probeCfx(code, timeout) {
  const r = await timedGet(`${config.fivem.apiBase}/${code}`, timeout);
  if (!r.ok) return r;
  const Data = r.data?.Data;
  if (!Data) return { ok: false, ms: r.ms, err: 'no-data' };
  const players = Array.isArray(Data.clients) ? Data.clients.length : (Data.clients ?? Data.players?.length ?? null);
  return {
    ok: true,
    ms: r.ms,
    players,
    maxPlayers: Data.sv_maxclients ?? null,
    hostname: (Data.hostname || '').replace(/\^[0-9]/g, '').trim() || null,
    endpoints: Array.isArray(Data.connectEndPoints) ? Data.connectEndPoints : [],
  };
}

// Pilih base URL direct dari connectEndPoints (ip:port, host:port, atau URL proxy cfx).
function pickDirectBase(endpoints) {
  for (const ep of endpoints || []) {
    if (typeof ep !== 'string' || !ep.trim()) continue;
    const v = ep.trim();
    if (/^https?:\/\//i.test(v)) return v.replace(/\/$/, '');
    if (/^[\w.\-]+:\d+$/.test(v) || /^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
      return `http://${normalizeDirectAddress(v)}`;
    }
  }
  return null;
}

async function probeDirect(baseUrl, timeout) {
  const r = await timedGet(`${baseUrl}/info.json`, timeout);
  if (!r.ok) return r;
  const vars = r.data?.vars || {};
  return {
    ok: true,
    ms: r.ms,
    resources: Array.isArray(r.data?.resources) ? r.data.resources.length : null,
    maxPlayers: vars.sv_maxClients ? parseInt(vars.sv_maxClients, 10) : (vars.sv_maxclients ? parseInt(vars.sv_maxclients, 10) : null),
  };
}

// ─── Ringkasan satu layer ────────────────────────────────────────────────────
function summarizeLayer(list) {
  const total = list.length;
  const okList = list.filter((s) => s.ok);
  const lat = okList.map((s) => s.ms);
  const sorted = [...lat].sort((a, b) => a - b);
  const errors = {};
  for (const s of list) if (!s.ok) errors[s.err] = (errors[s.err] || 0) + 1;

  let tailFails = 0;
  for (let i = list.length - 1; i >= 0 && !list[i].ok; i--) tailFails++;

  return {
    used: true,
    total,
    ok: okList.length,
    successRate: total ? okList.length / total : 0,
    errors,
    avg: lat.length ? Math.round(mean(lat)) : null,
    min: sorted.length ? sorted[0] : null,
    max: sorted.length ? sorted[sorted.length - 1] : null,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    jitter: Math.round(stdDev(lat)),
    tailFails,
  };
}

const NOT_USED = (reason) => ({ used: false, reason, total: 0, ok: 0, errors: {} });

function topError(errors) {
  const e = Object.entries(errors || {}).sort((a, b) => b[1] - a[1])[0];
  return e ? e[0] : null;
}

// ─── Fungsi utama ────────────────────────────────────────────────────────────
export async function runDdosCheck(serverInput, opts = {}) {
  const samples = Math.min(Math.max(opts.samples ?? config.ddos.samples, 1), MAX_SAMPLES);
  const intervalMs = Math.min(Math.max(opts.intervalMs ?? config.ddos.sampleIntervalMs, MIN_INTERVAL_MS), MAX_INTERVAL_MS);
  const timeout = config.ddos.probeTimeoutMs;

  const { endpoint, dbRow } = resolveEndpoint(serverInput);
  const key = String(endpoint).toLowerCase();

  // Cooldown per-target: hasil terbaru dipakai ulang → tidak ada traffic tambahan ke target.
  const runKey = `${key}|${samples}`;
  const prev = recentRuns.get(runKey);
  if (prev && Date.now() - prev.ts < config.ddos.runCooldownMs) {
    return { ...prev.result, cached: true, cacheAgeSec: Math.round((Date.now() - prev.ts) / 1000) };
  }

  const viaCfx = isCfxCode(endpoint);
  const code = viaCfx ? extractCfxCode(endpoint) : null;

  let directBase = viaCfx ? (directBaseMemo.get(key) || null) : `http://${normalizeDirectAddress(endpoint)}`;
  let directSkipReason = null;

  const cfxSamples = [];
  const directSamples = [];
  let hostname = dbRow?.name || null;
  let currentPlayers = null;
  let maxPlayers = null;

  for (let i = 0; i < samples; i++) {
    if (viaCfx) {
      if (i === 0) {
        // Sampel pertama: butuh meta CFX dulu untuk menemukan alamat direct.
        const c = await probeCfx(code, timeout);
        cfxSamples.push(c);
        if (c.ok) {
          hostname = c.hostname || hostname;
          currentPlayers = c.players ?? currentPlayers;
          maxPlayers = c.maxPlayers ?? maxPlayers;
          const found = pickDirectBase(c.endpoints);
          if (found) { directBase = found; directBaseMemo.set(key, found); }
        }
        if (directBase) directSamples.push(await probeDirect(directBase, timeout));
        else directSkipReason = c.ok
          ? 'CFX tidak mengekspos alamat server (origin disembunyikan)'
          : 'Alamat server belum diketahui karena CFX API gagal di sampel pertama';
      } else {
        const [c, d] = await Promise.all([
          probeCfx(code, timeout),
          directBase ? probeDirect(directBase, timeout) : Promise.resolve(null),
        ]);
        cfxSamples.push(c);
        if (c.ok) {
          currentPlayers = c.players ?? currentPlayers;
          maxPlayers = c.maxPlayers ?? maxPlayers;
          // Kalau tadinya belum ketemu alamat direct, coba lagi dari meta terbaru.
          if (!directBase) {
            const found = pickDirectBase(c.endpoints);
            if (found) { directBase = found; directBaseMemo.set(key, found); directSkipReason = null; }
          }
        }
        if (d) directSamples.push(d);
      }
    } else {
      directSamples.push(await probeDirect(directBase, timeout));
    }
    if (i < samples - 1) await sleep(intervalMs);
  }

  // Server direct (non-CFX): ambil player count SEKALI (bukan per sampel).
  if (!viaCfx && directSamples.some((s) => s.ok)) {
    const pj = await timedGet(`${directBase}/players.json`, timeout);
    if (pj.ok && Array.isArray(pj.data)) currentPlayers = pj.data.length;
    const withMax = directSamples.find((s) => s.ok && s.maxPlayers);
    if (withMax) maxPlayers = withMax.maxPlayers;
  }

  const cfx = viaCfx ? summarizeLayer(cfxSamples) : NOT_USED('Server diakses langsung (bukan via CFX code)');
  const direct = directSamples.length ? summarizeLayer(directSamples) : NOT_USED(directSkipReason || 'Tidak tersedia');

  // Layer utama = direct kalau ada (itu yang mewakili server sebenarnya).
  const primary = direct.used ? direct : cfx;
  const primaryName = direct.used ? 'direct' : 'cfx';

  // ─── Riwayat & baseline ────────────────────────────────────────────────────
  const now = Date.now();
  const hist = (history.get(key) || []).filter((h) => now - h.ts < HISTORY_MAX_AGE_MS);
  const prevEntry = hist[hist.length - 1] || null;
  const baselineLat = hist.filter((h) => h.avgLatency != null && h.successRate >= 0.8).slice(-10).map((h) => h.avgLatency);
  const baseline = baselineLat.length >= 3 ? { medianLatency: Math.round(median(baselineLat)), n: baselineLat.length } : null;

  let playerDropPct = null;
  if (prevEntry?.players > 0 && currentPlayers != null) {
    playerDropPct = Math.round((1 - currentPlayers / prevEntry.players) * 100);
  }

  // ─── Analisis ──────────────────────────────────────────────────────────────
  const flags = [];
  const causes = [];
  let severity = 'ok';
  let score = 0;
  const bump = (s) => {
    const order = { ok: 0, warning: 1, critical: 2 };
    if (order[s] > order[severity]) severity = s;
  };
  const cfg = config.ddos;

  // 1) Ketersediaan layer direct
  if (direct.used) {
    const lossPct = Math.round((1 - direct.successRate) * 100);
    if (direct.ok === 0) {
      const err = topError(direct.errors);
      if (cfx.used && cfx.ok > 0) {
        flags.push(`Probe langsung ke server gagal total (${err}) padahal CFX API masih memberi data. Server tidak terjangkau dari host bot.`);
        score += 35; bump('warning');
        causes.push('Server/port tidak terjangkau dari bot — bisa serangan, firewall/proxy yang menolak probe HTTP, atau proses server mati.');
      } else {
        flags.push(`Server tidak merespons sama sekali di semua percobaan (${err}).`);
        score += 60; bump('critical');
      }
    } else if (direct.successRate < cfg.packetLossCriticalThreshold) {
      flags.push(`Packet loss tinggi ke server: ${lossPct}% percobaan gagal.`);
      score += 45; bump('critical');
    } else if (direct.successRate < cfg.packetLossWarningThreshold) {
      flags.push(`Ada packet loss ke server: ${lossPct}% percobaan gagal.`);
      score += 25; bump('warning');
    }
  }

  // 2) Layer CFX API
  if (cfx.used) {
    const lossPct = Math.round((1 - cfx.successRate) * 100);
    if (cfx.ok === 0) {
      if (direct.used && direct.ok > 0) {
        flags.push(`CFX API tidak merespons (${topError(cfx.errors)}) tapi server sendiri merespons normal.`);
        causes.push('Masalah ada di API CFX/Cloudflare atau jaringan menuju CFX, bukan di server — kemungkinan bukan DDoS ke server.');
        score += 5;
      } else if (!direct.used) {
        flags.push(`CFX API tidak merespons sama sekali (${topError(cfx.errors)}).`);
        score += 40; bump('critical');
      } else {
        score += 10;
      }
    } else if (cfx.successRate < cfg.packetLossWarningThreshold) {
      flags.push(`CFX API sebagian gagal: ${lossPct}% percobaan.`);
      score += 8; bump('warning');
    }
  }

  // 3) Latency layer utama
  if (primary.avg != null) {
    if (primary.avg > cfg.latencyCriticalMs) {
      flags.push(`Latency rata-rata sangat tinggi: ${primary.avg}ms.`);
      score += 20; bump('critical');
    } else if (primary.avg > cfg.latencyWarningMs) {
      flags.push(`Latency rata-rata tinggi: ${primary.avg}ms.`);
      score += 10; bump('warning');
    }
  }

  // 4) Lonjakan latency (p95 jauh di atas median) & jitter
  if (primary.ok >= 4 && primary.p50 != null && primary.p95 > Math.max(primary.p50 * 3, 1000)) {
    flags.push(`Lonjakan latency: p95 ${primary.p95}ms vs median ${primary.p50}ms.`);
    score += 10; bump('warning');
    causes.push('Lonjakan latency berselang-seling khas jalur jaringan yang jenuh (congestion) atau serangan volumetrik ringan.');
  }
  if (primary.ok >= 3 && primary.jitter > cfg.jitterWarningMs) {
    flags.push(`Koneksi tidak stabil (variasi latency ${primary.jitter}ms).`);
    score += 8; bump('warning');
  }

  // 5) Memburuk di akhir pengecekan
  if (primary.total >= 4 && primary.ok > 0 && primary.tailFails >= 3) {
    flags.push(`Koneksi memburuk: ${primary.tailFails} sampel terakhir berturut-turut gagal.`);
    score += 15; bump('warning');
  }

  // 6) Dibanding baseline historis bot
  if (baseline && primary.avg != null && primary.avg > Math.max(baseline.medianLatency * 3, 300)) {
    flags.push(`Latency ${(primary.avg / Math.max(baseline.medianLatency, 1)).toFixed(1)}× lebih tinggi dari normal (baseline ${baseline.medianLatency}ms, ${baseline.n} cek terakhir).`);
    score += 10; bump('warning');
  }

  // 7) Player drop
  if (playerDropPct != null && playerDropPct >= cfg.playerDropWarningPct) {
    flags.push(`Jumlah player turun drastis ${playerDropPct}% dibanding pengecekan sebelumnya.`);
    score += 15; bump('warning');
    causes.push('Penurunan player massal bersamaan dengan gangguan koneksi sering terjadi saat serangan atau crash server.');
  }

  // 8) Hipotesis dari jenis error layer utama
  const errs = primary.errors || {};
  const errTotal = Object.values(errs).reduce((a, b) => a + b, 0);
  if (errTotal > 0) {
    if (errs.ECONNREFUSED) causes.push('ECONNREFUSED: port menolak koneksi → proses FiveM mati/restart atau port salah (lebih mirip downtime daripada DDoS).');
    if (errs.ENOTFOUND) causes.push('ENOTFOUND: domain tidak ter-resolve → masalah DNS atau domain salah.');
    if (errs.ECONNRESET) causes.push('ECONNRESET: koneksi diputus paksa → proteksi anti-DDoS/firewall aktif, atau server overload.');
    if (errs.EHOSTUNREACH || errs.ENETUNREACH) causes.push('Host/jaringan tidak terjangkau → masalah routing/provider atau IP di-null-route.');
    if (errs.timeout && !errs.ECONNREFUSED) causes.push('Timeout: paket tidak dibalas → khas saturasi bandwidth/serangan, host overload, atau paket di-drop firewall.');
    const http = Object.keys(errs).filter((e) => e.startsWith('HTTP '));
    if (http.length) causes.push(`${http.join(', ')}: server menjawab dengan error HTTP → rate-limit/WAF (403/429) atau aplikasi bermasalah (5xx).`);
  }

  score = Math.min(100, Math.round(score));
  if (severity === 'critical') score = Math.max(score, 60);
  else if (severity === 'warning') score = Math.max(Math.min(score, 59), 25);
  else score = Math.min(score, 24);

  const label = severity === 'critical'
    ? '🔴 Indikasi Kuat Gangguan/DDoS'
    : severity === 'warning'
      ? '🟡 Ada Indikasi Anomali'
      : '🟢 Sehat / Normal';

  const recommendations = [];
  if (severity !== 'ok') {
    recommendations.push('Ulangi cek 1–2 menit lagi untuk memastikan gangguannya konsisten, bukan sekadar glitch sesaat.');
    recommendations.push('Buka panel hosting/VPS: lihat grafik traffic masuk & CPU — lonjakan tajam tanpa kenaikan player = indikasi serangan.');
    recommendations.push('Cek console txAdmin: server crash, hitch warning, atau resource yang error.');
    if (severity === 'critical') recommendations.push('Hubungi provider hosting dan minta mitigasi/anti-DDoS (atau aktifkan proteksi jika ada).');
  }

  // ─── Simpan riwayat ────────────────────────────────────────────────────────
  hist.push({ ts: now, avgLatency: primary.avg, successRate: primary.successRate, players: currentPlayers });
  history.set(key, hist.slice(-HISTORY_MAX));

  const timeline = Array.from({ length: Math.max(cfxSamples.length, directSamples.length) }, (_, i) => ({
    cfx: viaCfx ? cfxSamples[i] || null : null,
    direct: directSamples[i] || null,
  })).map((row) => ({
    cfx: row.cfx ? { ok: row.cfx.ok, ms: row.cfx.ms, err: row.cfx.err } : null,
    direct: row.direct ? { ok: row.direct.ok, ms: row.direct.ms, err: row.direct.err } : null,
  }));

  const result = {
    serverInput,
    hostname,
    mode: viaCfx ? 'cfx' : 'direct',
    samples,
    intervalMs,
    // Kompatibel dengan ddoscheckall & embed lama:
    successRate: primary.successRate,
    avgLatency: primary.avg,
    minLatency: primary.min,
    maxLatency: primary.max,
    jitter: primary.jitter,
    p50: primary.p50,
    p95: primary.p95,
    primaryLayer: primaryName,
    layers: { cfx, direct },
    timeline,
    currentPlayerCount: currentPlayers,
    maxPlayers,
    playerDropPct,
    baseline,
    riskScore: score,
    severity,
    label,
    flags,
    causes: [...new Set(causes)],
    recommendations,
    cached: false,
    checkedAt: now,
  };

  recentRuns.set(runKey, { ts: now, result });
  // Bersihkan entri cooldown yang sudah kedaluwarsa agar Map tidak membengkak.
  if (recentRuns.size > 200) {
    for (const [k, v] of recentRuns) if (now - v.ts > config.ddos.runCooldownMs) recentRuns.delete(k);
  }
  return result;
}
