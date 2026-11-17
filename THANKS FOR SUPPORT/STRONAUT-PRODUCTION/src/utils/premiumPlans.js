// =======================================================
// SATU-SATUNYA sumber paket & daftar fitur premium.
// Dipakai bersama oleh: !bayar (bot), tombol help, dan halaman beli di website.
// Ubah harga / durasi cukup di .env (PREMIUM_PLANS) — bot & web ikut berubah.
// =======================================================

/** Fitur premium. Dipakai embed bot (!bayar) dan daftar fitur di website. */
export const PREMIUM_FEATURES = [
  { cmds: ['player'],                  desc: 'Cari player berdasarkan nama di server FiveM' },
  { cmds: ['allplayer'],               desc: 'Lihat semua player online + pagination' },
  { cmds: ['loop'],                    desc: 'Auto-cari pemain otomatis' },
  { cmds: ['playingtime', 'settime'],  desc: 'Cek jam main & laporan playtime otomatis tiap pagi' },
  { cmds: ['ddoscheck', 'ddoscheckall'], desc: 'Deteksi indikasi DDoS/gangguan koneksi server' },
  { cmds: ['cfxfinder'],               desc: 'Lihat semua informasi server melalui CFX code' },
  { cmds: ['setmonitor'],              desc: 'Monitoring server andalan kamu' },
  { cmds: ['settextstatusall'],        desc: 'Tampilkan player online semua server di channel pilihan' },
];

const DEFAULT_PLANS = [
  { id: 'p30',  name: 'Premium 30 Hari',  days: 30,  price: 15000,  badge: '',           perks: [] },
  { id: 'p90',  name: 'Premium 90 Hari',  days: 90,  price: 40000,  badge: 'Hemat 11%',  perks: [] },
  { id: 'p365', name: 'Premium 365 Hari', days: 365, price: 150000, badge: 'Best Value', perks: [] },
];

function normalize(list) {
  return list
    .map((x) => ({
      id: String(x.id || '').trim().toLowerCase(),
      name: String(x.name || '').trim(),
      days: Number(x.days),
      price: Number(x.price),
      badge: x.badge ? String(x.badge) : '',
      perks: Array.isArray(x.perks) ? x.perks.map(String) : [],
    }))
    .filter((x) => /^[a-z0-9_-]{1,20}$/.test(x.id) && x.name && x.days > 0 && x.price >= 500);
}

let warned = false;

/** Daftar paket aktif. Urutan pertama = paket default untuk !bayar. */
export function getPlans() {
  if (process.env.PREMIUM_PLANS) {
    try {
      const parsed = JSON.parse(process.env.PREMIUM_PLANS);
      const plans = Array.isArray(parsed) ? normalize(parsed) : [];
      if (plans.length) return plans;
      if (!warned) { console.error('[Premium] PREMIUM_PLANS kosong/tidak valid — pakai paket default.'); warned = true; }
    } catch (e) {
      if (!warned) { console.error('[Premium] PREMIUM_PLANS bukan JSON valid:', e.message); warned = true; }
    }
  }

  // Kompatibel dengan setup lama bot: PAYMENT_PRICE / PAYMENT_DURATION_DAYS => satu paket.
  if (process.env.PAYMENT_PRICE || process.env.PAYMENT_DURATION_DAYS) {
    const days = parseInt(process.env.PAYMENT_DURATION_DAYS, 10) || 30;
    const price = parseInt(process.env.PAYMENT_PRICE, 10) || 25000;
    return [{ id: `p${days}`, name: `Premium ${days} Hari`, days, price, badge: '', perks: [] }];
  }

  return DEFAULT_PLANS;
}

export function getPlan(id) {
  if (!id) return null;
  const key = String(id).trim().toLowerCase();
  return getPlans().find((p) => p.id === key) || null;
}

export function getDefaultPlan() {
  return getPlans()[0];
}

export const rupiah = (n) => 'Rp ' + Number(n).toLocaleString('id-ID');
