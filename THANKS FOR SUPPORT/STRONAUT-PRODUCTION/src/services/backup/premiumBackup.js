import crypto from 'crypto';
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../../database/db.js';
import { config } from '../../config/config.js';

// =======================================================
// BACKUP SEMUA DATABASE → GMAIL OWNER
// -------------------------------------------------------
// SEMUA tabel database (server, monitor, premium, transaksi, playtime, dll)
// dikirim sebagai lampiran .json.gz (terkompres) ke Gmail owner:
//   • otomatis saat bot start
//   • otomatis begitu data premium berubah (dicek berkala)
//   • otomatis berkala (default 6 jam), karena data seperti playtime terus berubah
//   • manual lewat !premiumbackup
// Kalau hosting mati / database hilang, ambil email backup terbaru lalu
// pulihkan lewat !premiumbackup restore (lampirkan file backup-nya).
// =======================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.resolve(__dirname, '../../../', config.db.path.replace('./', ''));
const STATE_FILE = path.join(path.dirname(DB_FILE), '.premium-backup-state.json');

// Tabel premium: dipantau untuk deteksi perubahan & di-restore dengan aturan "versi terbaru menang".
export const PREMIUM_TABLES = ['guild_subscriptions', 'donors', 'redeem_codes', 'transactions'];
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // batas aman lampiran Gmail (25 MB)

function listAllTables(db) {
  return db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .all()
    .map((r) => r.name);
}
const BACKUP_FORMAT = 'stronaut-premium-backup';

const MIN_GAP_MS = 60 * 1000; // jarak minimum antar email (anti-spam)
let sending = false;
let lastSentAt = 0;

export function isBackupConfigured() {
  const b = config.backup;
  return Boolean(b.gmailUser && b.gmailAppPassword && b.emailTo);
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (err) {
    console.warn('[Backup] Gagal menyimpan state:', err.message);
  }
}

// LITE: hash cek-perubahan hanya membaca 4 tabel premium (kecil), bukan seluruh DB
// (playtime bisa puluhan ribu baris dan dulu ikut dimuat+di-JSON tiap 5 menit).
function premiumHashOnly() {
  const db = getDb();
  const existing = new Set(listAllTables(db));
  const premiumOnly = {};
  for (const t of PREMIUM_TABLES) {
    premiumOnly[t] = existing.has(t) ? db.prepare(`SELECT * FROM "${t}"`).all() : [];
  }
  return crypto.createHash('sha256').update(JSON.stringify(premiumOnly)).digest('hex');
}

export function exportPremiumData() {
  const db = getDb();
  const tables = {};
  for (const t of listAllTables(db)) {
    tables[t] = db.prepare(`SELECT * FROM "${t}"`).all();
  }
  // Hash HANYA dari tabel premium: tabel seperti playtime berubah tiap menit,
  // kalau ikut di-hash backup akan terkirim terus-menerus.
  const premiumOnly = Object.fromEntries(PREMIUM_TABLES.map((t) => [t, tables[t] || []]));
  const hash = crypto.createHash('sha256').update(JSON.stringify(premiumOnly)).digest('hex');
  const counts = Object.fromEntries(Object.entries(tables).map(([t, rows]) => [t, rows.length]));
  const payload = {
    format: BACKUP_FORMAT,
    version: 2,
    exported_at: new Date().toISOString(),
    bot: `${config.bot.name} v${config.bot.version}`,
    counts,
    tables,
  };
  return { payload, hash, counts };
}

/** Baca file backup (.json atau .json.gz) → object payload. */
export function parseBackupBuffer(buf) {
  const raw = buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf;
  return JSON.parse(raw.toString('utf8'));
}

/**
 * Kirim backup ke Gmail.
 * force=false → dilewati kalau data sama persis dengan backup terakhir yang terkirim.
 */
export async function sendPremiumBackup({ reason = 'manual', force = false } = {}) {
  if (!isBackupConfigured()) return { ok: false, error: 'BACKUP_* belum diisi di .env' };
  if (sending) return { ok: false, error: 'Backup sedang berjalan' };

  const state = readState();
  // LITE: untuk cek berkala, hitung hash premium dulu; kalau sama langsung selesai
  // tanpa memuat seluruh database ke memori.
  if (!force && reason === 'ada perubahan data' && state.lastHash === premiumHashOnly()) {
    return { ok: true, skipped: 'tidak ada perubahan' };
  }
  const { payload, hash, counts } = exportPremiumData();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // Jangan email backup KOSONG otomatis (mis. hosting baru + DB baru) —
  // email lama yang berisi data tetap aman di inbox.
  if (!force && total === 0) {
    console.warn('[Backup] Database kosong — backup otomatis dilewati.');
    return { ok: true, skipped: 'database kosong', counts };
  }
  // 'change' = cek berkala: hanya kirim kalau data premium berubah.
  if (!force && reason === 'ada perubahan data' && state.lastHash === hash) {
    return { ok: true, skipped: 'tidak ada perubahan', counts };
  }
  if (Date.now() - lastSentAt < MIN_GAP_MS) return { ok: false, error: 'Terlalu cepat, coba lagi sebentar' };

  let nodemailer;
  try {
    nodemailer = (await import('nodemailer')).default;
  } catch {
    return { ok: false, error: 'Package `nodemailer` belum terpasang. Jalankan: npm install' };
  }

  sending = true;
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: config.backup.gmailUser, pass: config.backup.gmailAppPassword },
    });

    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const filename = `stronaut-db-backup-${stamp}.json.gz`;
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify(payload)), { level: 6 });
    if (gz.length > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: `Backup terlalu besar untuk email (${(gz.length / 1048576).toFixed(1)} MB, batas ~20 MB).` };
    }
    const summary = Object.entries(counts).map(([t, n]) => `• ${t}: ${n} baris`).join('\n');

    await transporter.sendMail({
      from: `"${config.bot.name} Backup" <${config.backup.gmailUser}>`,
      to: config.backup.emailTo,
      subject: `[${config.bot.name}] Backup Database — ${counts.guild_subscriptions ?? 0} server premium — ${stamp}`,
      text:
        `Backup SELURUH database ${config.bot.name} (${reason}).\n\n${summary}\n\n` +
        `Cara restore: kirim file .json.gz terlampir ke bot dengan command ` +
        `${config.bot.prefix}premiumbackup restore (lampirkan file-nya di pesan yang sama).\n\n` +
        `⚠️ File ini berisi seluruh data bot (kode redeem, ID server, dll). Jangan dibagikan ke orang lain.`,
      attachments: [{ filename, content: gz, contentType: 'application/gzip' }],
    });

    lastSentAt = Date.now();
    writeState({ lastHash: hash, lastSentAt: new Date().toISOString(), counts });
    console.log(`[Backup] Seluruh database terkirim ke ${config.backup.emailTo} (${reason}) — ${(gz.length / 1024).toFixed(0)} KB.`);
    return { ok: true, counts, filename };
  } catch (err) {
    console.error('[Backup] Gagal kirim email:', err.message);
    return { ok: false, error: err.message };
  } finally {
    sending = false;
  }
}

export function getBackupStatus() {
  const { counts } = exportPremiumData();
  return { configured: isBackupConfigured(), to: config.backup.emailTo, state: readState(), counts };
}

export function startPremiumBackup() {
  if (!isBackupConfigured()) {
    console.warn('[Backup] BACKUP_GMAIL_USER / BACKUP_GMAIL_APP_PASSWORD / BACKUP_EMAIL_TO belum diisi — backup premium ke Gmail NONAKTIF.');
    return;
  }

  const checkMs = Math.max(1, config.backup.checkMinutes) * 60 * 1000;
  const forceMs = Math.max(1, config.backup.forceEveryHours) * 60 * 60 * 1000;

  setTimeout(() => sendPremiumBackup({ reason: 'startup' }), 20 * 1000);
  setInterval(() => sendPremiumBackup({ reason: 'ada perubahan data' }), checkMs);
  setInterval(() => sendPremiumBackup({ reason: 'backup berkala', force: true }), forceMs);

  console.log(`[Backup] Aktif → ${config.backup.emailTo} (cek perubahan tiap ${config.backup.checkMinutes} menit, backup penuh tiap ${config.backup.forceEveryHours} jam).`);
}

// =======================================================
// RESTORE
// -------------------------------------------------------
// Aman dijalankan di atas database yang sudah berisi data:
//  • baris yang belum ada → ditambahkan (semua tabel)
//  • tabel premium: baris yang sudah ada ditimpa hanya kalau backup lebih baru
//  • tabel lain: baris yang sudah ada dibiarkan apa adanya
//  • kode redeem yang sudah terpakai tidak akan "hidup lagi"
// =======================================================
export function restorePremiumData(payload) {
  if (!payload || payload.format !== BACKUP_FORMAT || !payload.tables) {
    throw new Error('File bukan backup premium STRONAUT yang valid.');
  }
  const db = getDb();
  const t = payload.tables;
  const result = {};

  const stmts = {
    guild_subscriptions: db.prepare(`
      INSERT INTO guild_subscriptions (guild_id, is_active, activated_at, expires_at, source, updated_at)
      VALUES (@guild_id, @is_active, @activated_at, @expires_at, @source, @updated_at)
      ON CONFLICT(guild_id) DO UPDATE SET
        is_active = excluded.is_active, activated_at = excluded.activated_at,
        expires_at = excluded.expires_at, source = excluded.source, updated_at = excluded.updated_at
      WHERE COALESCE(excluded.updated_at, '') > COALESCE(guild_subscriptions.updated_at, '')`),
    donors: db.prepare(`
      INSERT INTO donors (user_id, is_active, code_used, activated_at, expires_at, updated_at)
      VALUES (@user_id, @is_active, @code_used, @activated_at, @expires_at, @updated_at)
      ON CONFLICT(user_id) DO UPDATE SET
        is_active = excluded.is_active, code_used = excluded.code_used,
        activated_at = excluded.activated_at, expires_at = excluded.expires_at, updated_at = excluded.updated_at
      WHERE COALESCE(excluded.updated_at, '') > COALESCE(donors.updated_at, '')`),
    redeem_codes: db.prepare(`
      INSERT INTO redeem_codes (code, duration_days, is_used, used_by, used_at, created_by, created_at)
      VALUES (@code, @duration_days, @is_used, @used_by, @used_at, @created_by, @created_at)
      ON CONFLICT(code) DO UPDATE SET
        is_used = MAX(redeem_codes.is_used, excluded.is_used),
        used_by = CASE WHEN redeem_codes.is_used = 0 AND excluded.is_used = 1 THEN excluded.used_by ELSE redeem_codes.used_by END,
        used_at = CASE WHEN redeem_codes.is_used = 0 AND excluded.is_used = 1 THEN excluded.used_at ELSE redeem_codes.used_at END`),
    transactions: db.prepare(`
      INSERT INTO transactions (reference, merchant_ref, guild_id, channel_id, user_id, amount, duration_days,
                                status, qr_url, checkout_url, pay_code, created_at, paid_at, raw_expired_at)
      VALUES (@reference, @merchant_ref, @guild_id, @channel_id, @user_id, @amount, @duration_days,
              @status, @qr_url, @checkout_url, @pay_code, @created_at, @paid_at, @raw_expired_at)
      ON CONFLICT(reference) DO UPDATE SET status = excluded.status, paid_at = excluded.paid_at
      WHERE transactions.paid_at IS NULL AND excluded.paid_at IS NOT NULL`),
  };

  const existing = new Set(listAllTables(db));
  const generic = (name) => {
    const cols = db.prepare(`PRAGMA table_info("${name}")`).all().map((c) => c.name);
    const list = cols.map((c) => `"${c}"`).join(', ');
    const params = cols.map((c) => `@${c}`).join(', ');
    return { cols, stmt: db.prepare(`INSERT OR IGNORE INTO "${name}" (${list}) VALUES (${params})`) };
  };

  const tx = db.transaction(() => {
    for (const name of Object.keys(t)) {
      if (!existing.has(name)) continue;
      let ok = 0;
      let skipped = 0;
      const g = stmts[name] ? null : generic(name);
      for (const row of t[name] || []) {
        try {
          if (g) {
            const full = Object.fromEntries(g.cols.map((c) => [c, row[c] ?? null]));
            g.stmt.run(full);
          } else {
            stmts[name].run(row);
          }
          ok++;
        } catch (err) {
          skipped++;
          console.warn(`[Restore] ${name}: baris dilewati — ${err.message}`);
        }
      }
      result[name] = { diproses: ok, dilewati: skipped };
    }
  });
  tx();
  return result;
}
