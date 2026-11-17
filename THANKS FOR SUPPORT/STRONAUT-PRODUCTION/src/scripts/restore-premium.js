// Pemulihan lewat terminal (kalau bot belum bisa online):
//   npm run restore:premium -- path/ke/stronaut-premium-backup-XXXX.json.gz
import fs from 'fs';
import { initDb } from '../database/db.js';
import { restorePremiumData, parseBackupBuffer } from '../services/backup/premiumBackup.js';

const file = process.argv[2];
if (!file) {
  console.error('Pemakaian: npm run restore:premium -- <file-backup.json.gz>');
  process.exit(1);
}

initDb();
const result = restorePremiumData(parseBackupBuffer(fs.readFileSync(file)));
console.table(result);
console.log('Restore selesai.');
