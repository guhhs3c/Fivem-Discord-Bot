import { getDb } from '../database/db.js';
import { activateGuildSubscription } from './subscription.js';

/**
 * Tandai transaksi PAID + aktifkan subscription guild terkait.
 * Idempotent: kalau transaksi sudah PAID sebelumnya, gak nge-double aktivasi.
 * Dipanggil dari tombol Approve Owner (konfirmasi manual QRIS).
 */
export function markTransactionPaid(row) {
  const db = getDb();

  if (row.status !== 'PAID') {
    db.prepare(`UPDATE transactions SET status = 'PAID', paid_at = datetime('now') WHERE reference = ?`).run(row.reference);
  }

  return activateGuildSubscription(row.guild_id, row.duration_days, `manual:${row.reference}`);
}
