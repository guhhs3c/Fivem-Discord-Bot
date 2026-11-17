import { getDb } from '../database/db.js';

// =======================================================
// Quota harian GLOBAL untuk command !ask (dibatasi config.ask.dailyLimit,
// default 50/hari, dihitung dari SELURUH user gabungan — bukan per-user).
// Reset otomatis jam 00:00 WIB (Asia/Jakarta), gak peduli timezone OS
// server-nya di mana.
// =======================================================

function todayKeyWIB() {
  // 'en-CA' menghasilkan format YYYY-MM-DD, gampang dibandingkan sebagai string.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

/**
 * Ambil jumlah pemakaian !ask hari ini (WIB), gabungan semua user.
 */
export function getAskUsageToday() {
  const db = getDb();
  const row = db.prepare(`SELECT count FROM ask_usage WHERE usage_date = ?`).get(todayKeyWIB());
  return row?.count || 0;
}

/**
 * Tambah 1 ke counter pemakaian !ask hari ini (WIB), lalu kembalikan
 * jumlah total setelah ditambah — dipakai buat cek limit sekaligus hemat query.
 */
export function incrementAskUsage() {
  const db = getDb();
  const date = todayKeyWIB();

  db.prepare(
    `INSERT INTO ask_usage (usage_date, count)
     VALUES (?, 1)
     ON CONFLICT(usage_date) DO UPDATE SET count = count + 1`
  ).run(date);

  return getAskUsageToday();
}

/**
 * Kapan quota reset lagi, dalam bentuk teks singkat buat ditampilkan ke user.
 */
export function nextResetLabel() {
  return '00:00 WIB';
}
