import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: new URL('../../.env', import.meta.url).pathname });

export const config = {
  bot: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    prefix: process.env.PREFIX || '!',
    name: process.env.BOT_NAME || 'STRONAUT',
    version: process.env.BOT_VERSION || '5.1.0',
    activityRotateInterval: parseInt(process.env.ACTIVITY_ROTATE_INTERVAL) || 15000,
     bannerUrl: 'https://cdn.discordapp.com/attachments/1518308021103624262/1554378738928459786/b29dgg.gif?ex=6abcab82&is=6abb5a02&hm=3075ccf985ad982f28b03bf99aa1d85a8a755c57756c883ce2c03d4f71195602&',
  },
  discord: {
    guildId: process.env.GUILD_ID,
    ownerId: process.env.OWNER_ID,
    supportServer: process.env.SUPPORT_SERVER || 'https://discord.gg/jHZ3XA4Pjx',
  },
  logging: {
    // Channel untuk notifikasi bot join/leave server. Kosongkan untuk DM owner saja.
    guildLogChannelId: process.env.LOG_CHANNEL_ID || null,
  },
  colors: {
    primary: 0x5865F2,
    success: 0x57F287,
    danger: 0xED4245,
    warning: 0xFEE75C,
    info: 0x5865F2,
  },
  payment: {
    // QRIS statis milik owner (screenshot/export dari e-wallet atau m-banking).
    // Upload gambarnya kemanapun (imgur, cdn discord, dll) lalu taruh link-nya di sini.
    qrisImageUrl: process.env.QRIS_IMAGE_URL || null,
    // Harga & durasi subscription (per-guild, lihat guild_subscriptions).
    price: parseInt(process.env.PAYMENT_PRICE) || 25000,
    durationDays: parseInt(process.env.PAYMENT_DURATION_DAYS) || 30,
  },
  fivem: {
    apiBase: process.env.FIVEM_API_BASE || 'https://servers-frontend.fivem.net/api/servers/single',
    timeout: parseInt(process.env.FIVEM_API_TIMEOUT) || 8000,
  },
  ai: {
    // SnifoxAI Gateway (https://snifoxai.com) — AI Gateway OpenAI-compatible.
    // Cuma dipakai sebagai fallback !ask kalau rule-based intent matching gak nemu jawaban.
    // Setup: buat API key di dashboard SnifoxAI, isi SNIFOX_API_KEY di .env.
    // Aktif otomatis kalau SNIFOX_API_KEY diisi — gak perlu toggle enable terpisah.
    enabled: Boolean(process.env.SNIFOX_API_KEY),
    apiKey: process.env.SNIFOX_API_KEY || '',
    baseUrl: process.env.SNIFOX_BASE_URL || 'https://core.snifoxai.com/v1',
    // Cek daftar model & harga di https://snifoxai.com/models — pilih yang
    // kecil/murah/cepat biar !ask responsif (format: "provider/model-name").
    model: process.env.SNIFOX_MODEL || 'openai/gpt-4o-mini',
    timeout: parseInt(process.env.AI_TIMEOUT) || 15000,
    // Berapa lama jawaban AI di-cache di memori (ms) biar pertanyaan yang
    // sama gak nge-hit API lagi — bikin !ask instan & hemat kuota.
    cacheTtl: parseInt(process.env.AI_CACHE_TTL) || 300000,
  },
  ask: {
    // Batas TOTAL panggilan ke SnifoxAI (fallback AI !ask) per hari, GABUNGAN
    // SEMUA USER, reset 00:00 WIB. Pertanyaan yang kejawab rule-based (server
    // online/offline, cara pakai command, dll) TIDAK dihitung ke limit ini —
    // limit cuma berlaku buat lapis fallback AI-nya aja.
    dailyLimit: parseInt(process.env.ASK_DAILY_LIMIT) || 50,
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 30000,
    serverTtl: parseInt(process.env.SERVER_CACHE_TTL) || 60000,
  },
  loop: {
    minInterval: parseInt(process.env.LOOP_MIN_INTERVAL) || 30,
    maxInterval: parseInt(process.env.LOOP_MAX_INTERVAL) || 3600,
  },
  db: {
    path: process.env.DB_PATH || './database.sqlite',
  },
  // Heuristik deteksi DDoS/gangguan koneksi (!ddoscheck, !ddoscheckall).
  // Ini BUKAN alat serang — cuma ngirim beberapa GET ringan ke /info.json atau
  // CFX API buat ngukur packet loss & latency, jumlah sample dibatasi keras
  // di ddosDetectionService.js biar gak bisa disalahgunakan jadi flooder.
  ddos: {
    samples: parseInt(process.env.DDOS_SAMPLES) || 6,
    sampleIntervalMs: parseInt(process.env.DDOS_SAMPLE_INTERVAL_MS) || 800,
    // Di bawah persentase ini dianggap warning/critical (rate sukses, bukan gagal).
    packetLossWarningThreshold: parseFloat(process.env.DDOS_PACKET_LOSS_WARNING) || 0.8,
    packetLossCriticalThreshold: parseFloat(process.env.DDOS_PACKET_LOSS_CRITICAL) || 0.5,
    latencyWarningMs: parseInt(process.env.DDOS_LATENCY_WARNING_MS) || 1500,
    latencyCriticalMs: parseInt(process.env.DDOS_LATENCY_CRITICAL_MS) || 4000,
    jitterWarningMs: parseInt(process.env.DDOS_JITTER_WARNING_MS) || 1000,
    playerDropWarningPct: parseInt(process.env.DDOS_PLAYER_DROP_PCT) || 60,
    // Timeout tiap probe (ms) — lebih pendek dari timeout FiveM biar cek tidak kelamaan.
    probeTimeoutMs: parseInt(process.env.DDOS_PROBE_TIMEOUT_MS) || 5000,
    // Cooldown per-target: hasil cek dipakai ulang selama ini (anti-spam ke server target).
    runCooldownMs: parseInt(process.env.DDOS_RUN_COOLDOWN_MS) || 15000,
  },
  // Backup SELURUH database ke Gmail owner (lihat services/backup/premiumBackup.js).
  // BACKUP_GMAIL_APP_PASSWORD = "App Password" 16 karakter dari akun Google
  // (bukan password Gmail biasa). Butuh verifikasi 2 langkah aktif.
  backup: {
    gmailUser: process.env.BACKUP_GMAIL_USER || '',
    gmailAppPassword: (process.env.BACKUP_GMAIL_APP_PASSWORD || '').replace(/\s+/g, ''),
    emailTo: process.env.BACKUP_EMAIL_TO || process.env.BACKUP_GMAIL_USER || '',
    checkMinutes: parseInt(process.env.BACKUP_CHECK_MINUTES) || 5,
    forceEveryHours: parseInt(process.env.BACKUP_FORCE_EVERY_HOURS) || 6,
  },
  dashboard: {
    host: process.env.DASHBOARD_HOST || '127.0.0.1',
    port: parseInt(process.env.DASHBOARD_PORT) || 4000,
    user: process.env.DASHBOARD_USER || '',
    pass: process.env.DASHBOARD_PASS || '',
    // Domain website statis yang boleh manggil /api/public/* (pisahkan koma kalau lebih dari satu).
    // Contoh: https://stronaut-site.pages.dev,https://namadomainkamu.com
    publicOrigin: process.env.PUBLIC_SITE_ORIGIN || '',
    // URL publik dashboard/website ini (mis. https://dashboard.domainkamu.com).
    // Dipakai bot untuk menampilkan link beli premium di website. Opsional.
    siteUrl: (process.env.PUBLIC_SITE_URL || '').replace(/\/+$/, ''),
  },
};
