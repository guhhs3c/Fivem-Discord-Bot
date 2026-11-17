import { getServerStatus, resolveEndpoint } from './serverService.js';
import { getDb } from '../../database/db.js';

// ─── Konstanta ───────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 60 * 1000; // cek semua server aktif tiap 60 detik
const POLL_INTERVAL_SECONDS = POLL_INTERVAL_MS / 1000;
const REPORT_HOUR_WIB = 5;
const REPORT_MINUTE_WIB = 55; // 5 menit sebelum reset server jam 06:00 WIB

// Urutan prioritas identifier: yang paling stabil per akun didahulukan,
// biar histori playtime tetap nyambung walau player ganti nama in-game.
const IDENTIFIER_PRIORITY = ['license:', 'license2:', 'discord:', 'steam:', 'fivem:', 'live:', 'xbl:'];

let lastReportDateWIB = null; // guard biar laporan cuma kekirim sekali per hari

function extractIdentifier(identifiers = []) {
  for (const prefix of IDENTIFIER_PRIORITY) {
    const found = identifiers.find((id) => id.startsWith(prefix));
    if (found) return found;
  }
  return identifiers[0] || null;
}

/**
 * Samakan input server (bisa alias apa aja) ke satu "kunci" yang konsisten,
 * supaya data playtime-nya gak kepecah cuma gara-gara user pakai alias beda-beda.
 */
export function resolveCanonicalServerKey(serverInput) {
  const { dbRow } = resolveEndpoint(serverInput);
  return dbRow?.name || serverInput;
}

function nowIso() {
  return new Date().toISOString();
}

function upsertPlayerSeen(serverKey, identifier, name, intervalSeconds) {
  const db = getDb();
  const now = nowIso();
  const existing = db
    .prepare(`SELECT id FROM playtime WHERE server_input = ? AND identifier = ?`)
    .get(serverKey, identifier);

  if (existing) {
    db.prepare(
      `UPDATE playtime
       SET name = ?, last_seen = ?, total_seconds = total_seconds + ?, daily_seconds = daily_seconds + ?, is_online = 1
       WHERE id = ?`
    ).run(name, now, intervalSeconds, intervalSeconds, existing.id);
  } else {
    db.prepare(
      `INSERT INTO playtime (server_input, identifier, name, first_seen, last_seen, total_seconds, daily_seconds, is_online)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(serverKey, identifier, name, now, now, intervalSeconds, intervalSeconds);
  }
}

/**
 * Poll SEMUA server aktif di tabel `servers` sekali, lalu update playtime
 * pemain yang lagi online. Dipanggil berkala oleh startPlaytimePolling().
 */
let polling = false; // LITE: cegah putaran poll saling tumpuk kalau ada server lambat/offline

export async function pollAllServers() {
  if (polling) return;
  polling = true;
  try {
    await pollAllServersInner();
  } finally {
    polling = false;
  }
}

async function pollAllServersInner() {
  const rows = getDb().prepare(`SELECT * FROM servers WHERE is_active = 1`).all();
  if (!rows.length) return;

  for (const row of rows) {
    const serverKey = row.name;
    const input = (row.alias || '').split(',')[0]?.trim() || row.name;

    try {
      const status = await getServerStatus(input);
      if (!status.online) continue;

      // LITE: satu transaksi per server (1 fsync) — sebelumnya 1 fsync per statement per pemain.
      getDb().transaction(() => {
        getDb().prepare(`UPDATE playtime SET is_online = 0 WHERE server_input = ?`).run(serverKey);
        for (const p of status.players) {
          const identifier = extractIdentifier(p.identifiers);
          if (!identifier) continue; // server sembunyiin identifier (endpoint privacy) — skip
          const name = (p.name || 'Unknown').trim();
          upsertPlayerSeen(serverKey, identifier, name, POLL_INTERVAL_SECONDS);
        }
      })();
    } catch (err) {
      console.error(`[PlaytimeTracker] Gagal poll server "${serverKey}":`, err.message);
    }
  }
}

export function startPlaytimePolling() {
  pollAllServers(); // langsung jalan sekali pas start
  return setInterval(pollAllServers, POLL_INTERVAL_MS);
}

/**
 * Cari data playtime pemain. Cocokkan nama persis dulu, baru fallback ke LIKE.
 */
export function findPlaytimeByName(serverInput, nama) {
  const serverKey = resolveCanonicalServerKey(serverInput);
  const db = getDb();

  const exact = db
    .prepare(`SELECT * FROM playtime WHERE server_input = ? AND LOWER(name) = LOWER(?) ORDER BY last_seen DESC LIMIT 1`)
    .get(serverKey, nama);
  if (exact) return exact;

  return db
    .prepare(`SELECT * FROM playtime WHERE server_input = ? AND LOWER(name) LIKE LOWER(?) ORDER BY last_seen DESC LIMIT 1`)
    .get(serverKey, `%${nama}%`);
}

export function getPlaytimeByIdentifier(serverKey, identifier) {
  return getDb().prepare(`SELECT * FROM playtime WHERE server_input = ? AND identifier = ?`).get(serverKey, identifier);
}

export function addPlaytimeSubscription(discordId, serverInput, identifier, name) {
  const serverKey = resolveCanonicalServerKey(serverInput);
  getDb()
    .prepare(
      `INSERT INTO playtime_subscriptions (discord_id, server_input, player_identifier, player_name)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(discord_id, server_input, player_identifier) DO UPDATE SET player_name = excluded.player_name`
    )
    .run(discordId, serverKey, identifier, name);
}

export function removePlaytimeSubscriptions(discordId) {
  const info = getDb().prepare(`DELETE FROM playtime_subscriptions WHERE discord_id = ?`).run(discordId);
  return info.changes;
}

function listPlaytimeSubscriptions() {
  return getDb().prepare(`SELECT * FROM playtime_subscriptions`).all();
}

function resetDailyForServer(serverKey) {
  getDb().prepare(`UPDATE playtime SET daily_seconds = 0 WHERE server_input = ?`).run(serverKey);
}

function currentWIB() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: parseInt(get('hour'), 10),
    minute: parseInt(get('minute'), 10),
  };
}

async function sendDailyReports(client) {
  const subs = listPlaytimeSubscriptions();

  for (const sub of subs) {
    const player = getPlaytimeByIdentifier(sub.server_input, sub.player_identifier);
    const daily = player?.daily_seconds || 0;
    const total = player?.total_seconds || 0;

    const message =
      `📊 **Laporan Playing Time**\n` +
      `Server: **${sub.server_input}**\n` +
      `Nama: **${sub.player_name}**\n` +
      `Main hari ini: **${formatPlaytime(daily)}**\n` +
      `Total keseluruhan: **${formatPlaytime(total)}**\n` +
      `_Dikirim otomatis jam 05:55 WIB, sebelum reset server jam 06:00 WIB._`;

    try {
      const user = await client.users.fetch(sub.discord_id);
      await user.send(message);
    } catch (err) {
      console.error(`[PlaytimeTracker] Gagal kirim DM ke ${sub.discord_id}:`, err.message);
    }
  }

  // Reset "hari ini" buat semua server yang punya data playtime.
  const servers = getDb().prepare(`SELECT DISTINCT server_input FROM playtime`).all();
  for (const { server_input } of servers) {
    resetDailyForServer(server_input);
  }
}

export function formatPlaytime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  if (hours <= 0 && minutes <= 0) return 'kurang dari 1 menit';
  const parts = [];
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0) parts.push(`${minutes} menit`);
  return parts.join(' ');
}

export function formatSinceWIB(isoDate) {
  const then = new Date(isoDate).getTime();
  const days = Math.floor(Math.max(0, Date.now() - then) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'hari ini';
  if (days === 1) return '1 hari yang lalu';
  return `${days} hari yang lalu`;
}

export function formatDateWIB(isoDate) {
  return (
    new Date(isoDate).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB'
  );
}

/**
 * Cek tiap menit apakah sudah jam 05:55 WIB — kalau iya, kirim laporan sekali
 * (guard `lastReportDateWIB` biar gak dobel-kirim dalam menit yang sama/hari yang sama).
 */
export function startPlaytimeReportScheduler(client) {
  const check = async () => {
    const { date, hour, minute } = currentWIB();
    if (hour === REPORT_HOUR_WIB && minute === REPORT_MINUTE_WIB && lastReportDateWIB !== date) {
      lastReportDateWIB = date;
      try {
        await sendDailyReports(client);
        console.log('[PlaytimeTracker] Laporan harian 05:55 WIB terkirim.');
      } catch (err) {
        console.error('[PlaytimeTracker] Gagal kirim laporan harian:', err.message);
      }
    }
  };

  return setInterval(check, 60 * 1000);
}
