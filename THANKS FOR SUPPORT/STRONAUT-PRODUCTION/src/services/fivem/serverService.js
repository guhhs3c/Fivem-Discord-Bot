import axios from 'axios';
import { config } from '../../config/config.js';
import { getDb } from '../../database/db.js';

const cache = new Map();
const CACHE_MAX_ENTRIES = 100;

// LITE: cache status dulu tidak pernah dibersihkan & menyimpan JSON CFX utuh
// (bisa ratusan KB per entry). Bersihkan yang kedaluwarsa + batasi jumlahnya.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now - v.ts > config.cache.serverTtl * 2) cache.delete(k);
  }
  while (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
}, 5 * 60 * 1000).unref();

// Cloudflare di servers-frontend.fivem.net mulai memblokir request tanpa
// User-Agent browser (muncul sebagai 403/404 dari script/axios polos).
// Header ini bikin request kita "keliatan" seperti dari browser biasa.
export const FIVEM_API_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
};

/**
 * Resolve a server input to an endpoint string.
 * Supports:
 *   - Alias from DB → uses the stored endpoint/cfx_code
 *   - Direct CFX code (e.g. "abc123")
 *   - Direct IP:port (e.g. "[HIDDEN]")
 *   - Direct domain:port (e.g. "play.myserver.com:30120")
 *   - Domain without port → defaults to :30120
 */
export function resolveEndpoint(serverInput) {
  const db = getDb();

  // 1. Look up by alias
  const rows = db.prepare(`SELECT * FROM servers WHERE is_active = 1`).all();
  for (const row of rows) {
    const aliases = (row.alias || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
    if (aliases.includes(serverInput.toLowerCase()) || row.name?.toLowerCase() === serverInput.toLowerCase()) {
      return { endpoint: row.endpoint || row.cfx_code, dbRow: row };
    }
  }

  // 2. Direct input — return as-is
  return { endpoint: serverInput, dbRow: null };
}

/**
 * Determine if the endpoint is a CFX code or a direct address.
 * CFX code: short alphanumeric (no dots, no colons) or cfx.re URLs
 * Direct: contains dot or colon (IP or domain)
 */
export function isCfxCode(endpoint) {
  if (!endpoint) return false;
  // If it's purely alphanumeric without dots/colons, treat as CFX code
  if (/^[a-zA-Z0-9]+$/.test(endpoint)) return true;
  // If it contains cfx.re
  if (endpoint.includes('cfx.re') || endpoint.includes('fivem.net')) return true;
  return false;
}

/**
 * Normalize direct address to host:port format.
 * Accepts: "1.2.3.4", "[HIDDEN]", "play.server.com", "play.server.com:30120"
 */
export function normalizeDirectAddress(endpoint) {
  if (endpoint.includes('://')) {
    try {
      const u = new URL(endpoint);
      return `${u.hostname}:${u.port || 30120}`;
    } catch { }
  }
  // Has explicit port
  const lastColon = endpoint.lastIndexOf(':');
  if (lastColon !== -1) {
    const afterColon = endpoint.substring(lastColon + 1);
    if (/^\d+$/.test(afterColon)) {
      return endpoint; // already host:port
    }
  }
  return `${endpoint}:30120`;
}

/**
 * Fetch server data from CFX API.
 */
async function fetchViaCfx(cfxCode) {
  // Extract raw code if it's a full URL
  const code = cfxCode.replace(/.*cfx\.re\/join\//i, '').replace(/.*fivem\.net.*\/join\//i, '').replace(/\/$/, '').trim();
  const url = `${config.fivem.apiBase}/${code}`;
  const { data } = await axios.get(url, { timeout: config.fivem.timeout, headers: FIVEM_API_HEADERS });
  if (!data?.Data) throw new Error('Data tidak ditemukan dari CFX API');

  const Data = data.Data;
  const vars = Data.vars || {};
  const hostname = (Data.hostname || code).replace(/\^[0-9]/g, '').trim();

  return {
    serverData: data,
    hostname,
    playerCount: Array.isArray(Data.clients) ? Data.clients.length : (Data.clients ?? Data.players?.length ?? 0),
    maxPlayers: Data.sv_maxclients ?? 0,
    players: Data.players || [],
    endpoint: code,
    vars,
    oneSync: vars.onesync_enabled === 'true' || vars.OneSync_Enabled === 'true',
  };
}

/**
 * Fetch server data directly via host:port.
 * Uses /info.json and /players.json endpoints.
 */
async function fetchViaDirect(address) {
  const normalized = normalizeDirectAddress(address);
  const baseUrl = `http://${normalized}`;

  const [infoRes, playersRes] = await Promise.allSettled([
    axios.get(`${baseUrl}/info.json`, { timeout: config.fivem.timeout, headers: FIVEM_API_HEADERS }),
    axios.get(`${baseUrl}/players.json`, { timeout: config.fivem.timeout, headers: FIVEM_API_HEADERS }),
  ]);

  if (infoRes.status === 'rejected') {
    throw new Error(`Tidak bisa terhubung ke ${normalized}: ${infoRes.reason?.message}`);
  }

  const info = infoRes.value.data || {};
  const players = playersRes.status === 'fulfilled' ? (playersRes.value.data || []) : [];
  const vars = info.vars || {};
  const hostname = (info.vars?.sv_hostname || normalized).replace(/\^[0-9]/g, '').trim();

  // Build a structure similar to CFX API response
  const serverData = {
    Data: {
      hostname,
      vars,
      clients: players.length,
      sv_maxclients: vars.sv_maxclients ? parseInt(vars.sv_maxclients) : 1000,
      players,
    }
  };

  return {
    serverData,
    hostname,
    playerCount: players.length,
    maxPlayers: vars.sv_maxclients ? parseInt(vars.sv_maxclients) : 1000,
    players,
    endpoint: normalized,
    vars,
    oneSync: vars.onesync_enabled === 'true' || vars.OneSync_Enabled === 'true',
  };
}

export async function getServerStatus(serverInput) {
  const cacheKey = `status:${serverInput}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < config.cache.serverTtl) {
    return cached.data;
  }

  const { endpoint, dbRow } = resolveEndpoint(serverInput);

  let result;
  try {
    let fetched;
    if (isCfxCode(endpoint)) {
      fetched = await fetchViaCfx(endpoint);
    } else {
      fetched = await fetchViaDirect(endpoint);
    }

    result = {
      online: true,
      hostname: fetched.hostname,
      playerCount: fetched.playerCount,
      maxPlayers: fetched.maxPlayers,
      players: fetched.players,
      endpoint: fetched.endpoint,
      serverData: fetched.serverData,
      oneSync: fetched.oneSync,
      sv: fetched.serverData?.Data,
      dbRow,
    };
  } catch (err) {
    result = {
      online: false,
      error: err.message,
      hostname: serverInput,
      playerCount: 0,
      maxPlayers: 0,
      players: [],
      endpoint,
      serverData: null,
      dbRow,
    };
  }

  cache.set(cacheKey, { ts: Date.now(), data: result });
  return result;
}

export function clearServerCache(serverInput) {
  cache.delete(`status:${serverInput}`);
}

/**
 * Ping "mentah" — SATU request ringan ke /info.json (direct) atau CFX API,
 * TANPA lewat cache, khusus untuk dipakai sampling oleh ddosDetectionService.
 * Cuma ngukur latency + sukses/gagal + player count kalau ada, gak narik
 * players.json (lebih berat) karena ini bisa dipanggil berkali-kali beruntun.
 *
 * PENTING: ini dipakai untuk MENGECEK kesehatan koneksi server (deteksi
 * indikasi DDoS/downtime), BUKAN untuk mengirim traffic massal ke server.
 * Jumlah pemanggilan berulang harus selalu dibatasi di pemanggilnya.
 */
export async function pingRaw(serverInput) {
  const { endpoint, dbRow } = resolveEndpoint(serverInput);
  const start = Date.now();

  try {
    if (isCfxCode(endpoint)) {
      const code = endpoint
        .replace(/.*cfx\.re\/join\//i, '')
        .replace(/.*fivem\.net.*\/join\//i, '')
        .replace(/\/$/, '')
        .trim();
      const url = `${config.fivem.apiBase}/${code}`;
      const { data } = await axios.get(url, { timeout: config.fivem.timeout, headers: FIVEM_API_HEADERS });
      const latencyMs = Date.now() - start;

      const Data = data?.Data;
      if (!Data) {
        return { ok: false, latencyMs, error: 'Data tidak ditemukan dari CFX API', endpoint: code, dbRow };
      }

      const playerCount = Array.isArray(Data.clients)
        ? Data.clients.length
        : (Data.clients ?? Data.players?.length ?? null);

      return { ok: true, latencyMs, playerCount, endpoint: code, dbRow };
    }

    const normalized = normalizeDirectAddress(endpoint);
    const { data } = await axios.get(`http://${normalized}/info.json`, {
      timeout: config.fivem.timeout,
      headers: FIVEM_API_HEADERS,
    });
    const latencyMs = Date.now() - start;

    return { ok: true, latencyMs, playerCount: null, endpoint: normalized, dbRow, vars: data?.vars || {} };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return { ok: false, latencyMs, error: err.message, endpoint, dbRow };
  }
}