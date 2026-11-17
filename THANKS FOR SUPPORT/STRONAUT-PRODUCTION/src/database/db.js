import Database from 'better-sqlite3';
import { config } from '../config/config.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../', config.db.path.replace('./', ''));

let db;

export function initDb() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');     // LITE: aman di WAL, jauh lebih sedikit fsync
  db.pragma('cache_size = -16000');      // ~16 MB
  db.pragma('temp_store = MEMORY');
  db.pragma('wal_autocheckpoint = 1000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cfx_code TEXT,
      endpoint TEXT,
      alias TEXT,
      banner_url TEXT,
      is_active INTEGER DEFAULT 1,
      added_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

        CREATE TABLE IF NOT EXISTS voice_monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL UNIQUE,
      server_input TEXT NOT NULL,
      name_format TEXT DEFAULT '🟢 Players: {online}/{max}',
      offline_format TEXT DEFAULT '🔴 Server Offline',
      interval_sec INTEGER DEFAULT 300,
      last_name TEXT,
      is_active INTEGER DEFAULT 1,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS server_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cfx_code TEXT NOT NULL,
      name TEXT NOT NULL,
      requested_by TEXT,
      guild_id TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS loopfinder (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      server_input TEXT NOT NULL,
      target_name TEXT NOT NULL,
      interval_sec INTEGER DEFAULT 60,
      channel_id TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      server_input TEXT NOT NULL,
      interval_sec INTEGER DEFAULT 30,
      is_active INTEGER DEFAULT 1,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS all_servers_monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      interval_sec INTEGER DEFAULT 60,
      is_active INTEGER DEFAULT 1,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Kode redeem yang di-generate Owner setelah donatur bayar (manual via !bayar).
    -- duration_days = 0 artinya lifetime (gak pernah expired).
    CREATE TABLE IF NOT EXISTS redeem_codes (
      code TEXT PRIMARY KEY,
      duration_days INTEGER DEFAULT 0,
      is_used INTEGER DEFAULT 0,
      used_by TEXT,
      used_at TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Status donatur per user Discord (legacy, lintas server, gak per-guild).
    -- expires_at NULL = lifetime. Dipertahankan untuk kompatibilitas data lama.
    CREATE TABLE IF NOT EXISTS donors (
      user_id TEXT PRIMARY KEY,
      is_active INTEGER DEFAULT 1,
      code_used TEXT,
      activated_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Subscription berlaku per-GUILD (seluruh member di server Discord itu ikut kebagian akses),
    -- bukan per-user. expires_at NULL = lifetime.
    CREATE TABLE IF NOT EXISTS guild_subscriptions (
      guild_id TEXT PRIMARY KEY,
      is_active INTEGER DEFAULT 1,
      activated_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      source TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Transaksi pembayaran QRIS (manual). Dipakai untuk !bayar (create), tombol
    -- "Cek Pembayaran" (polling manual), dan webhook callback (otomatis).
    CREATE TABLE IF NOT EXISTS transactions (
      reference TEXT PRIMARY KEY,
      merchant_ref TEXT UNIQUE NOT NULL,
      guild_id TEXT NOT NULL,
      channel_id TEXT,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      status TEXT DEFAULT 'UNPAID',
      qr_url TEXT,
      checkout_url TEXT,
      pay_code TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      paid_at TEXT,
      raw_expired_at TEXT
    );

    -- Quota harian GLOBAL untuk command !ask (dibatasi config.ask.dailyLimit,
    -- dihitung dari seluruh user, bukan per-user). usage_date disimpan dalam
    -- format YYYY-MM-DD zona WIB (Asia/Jakarta), jadi reset-nya konsisten
    -- jam 00:00 WIB apapun timezone OS servernya.
    CREATE TABLE IF NOT EXISTS ask_usage (
      usage_date TEXT PRIMARY KEY,
      count INTEGER DEFAULT 0
    );

    -- Playing Time Tracker: akumulasi jam main per pemain per server.
    -- Diisi oleh poller (src/services/fivem/playtimeService.js) yang nge-cek
    -- players.json/CFX API tiap server aktif secara berkala, jadi playtime-nya
    -- estimasi berbasis "heartbeat" polling, bukan detik-per-detik persis.
    -- identifier dipakai sebagai kunci utama (bukan nama) biar tetap nyambung
    -- walau player ganti nama in-game. first_seen = kapan akun itu PERTAMA
    -- kali kedeteksi main di server ini (dipakai untuk fitur "umur akun").
    CREATE TABLE IF NOT EXISTS playtime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_input TEXT NOT NULL,
      identifier TEXT NOT NULL,
      name TEXT NOT NULL,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      total_seconds INTEGER NOT NULL DEFAULT 0,
      daily_seconds INTEGER NOT NULL DEFAULT 0,
      is_online INTEGER NOT NULL DEFAULT 0,
      UNIQUE(server_input, identifier)
    );

    -- Langganan laporan otomatis (!settime). Dikirim tiap 05:55 WIB, 5 menit
    -- sebelum reset server jam 06:00 WIB, lalu daily_seconds di tabel playtime
    -- direset ke 0 untuk server yang bersangkutan.
    CREATE TABLE IF NOT EXISTS playtime_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_id TEXT NOT NULL,
      server_input TEXT NOT NULL,
      player_identifier TEXT NOT NULL,
      player_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(discord_id, server_input, player_identifier)
    );
  `);

  // Housekeeping: buang catatan quota !ask yang sudah lewat beberapa hari,
  // biar tabel ask_usage gak numpuk terus seiring waktu.
  db.prepare(`DELETE FROM ask_usage WHERE usage_date < date('now', '-3 days')`).run();

  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}