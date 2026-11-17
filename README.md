<div align="center">

# 🤖 FiveM Discord Bot (Stronaut)

**Bot Discord multifungsi untuk manajemen, monitoring status server, dan integrasi komunitas FiveM secara real-time.**

[![GitHub Stars](https://img.shields.io/github/stars/guhhs3c/Fivem-Discord-Bot?style=for-the-badge&logo=github&color=yellow)](https://github.com/guhhs3c/Fivem-Discord-Bot/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/guhhs3c/Fivem-Discord-Bot?style=for-the-badge&logo=github&color=blue)](https://github.com/guhhs3c/Fivem-Discord-Bot/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/guhhs3c/Fivem-Discord-Bot?style=for-the-badge&logo=github&color=red)](https://github.com/guhhs3c/Fivem-Discord-Bot/issues)

[Laporkan Bug](https://github.com/guhhs3c/Fivem-Discord-Bot/issues) • [Request Fitur](https://github.com/guhhs3c/Fivem-Discord-Bot/issues) • [Dukung Project Ini](#-dukung-pengembangan-support)

</div>

💖 Dukung Pengembangan (Support)
Source code ini dibagikan secara gratis (Open Source) untuk membantu komunitas developer dan pemilik server FiveM. Jika project ini bermanfaat bagi server Anda, dukung terus pengembangan fitur-fitur berikutnya dengan cara:

⭐ Berikan Star pada repository ini di pojok kanan atas GitHub!

🍴 Fork & Kontribusi jika Anda ingin menambahkan fitur baru atau memperbaiki bug.

☕ Traktir Kopi / Donasi:

SocialBuzz : https://sociabuzz.com/guhhsec

Discord Community: https://discord.gg/5CPCP5QZPX

# 🚀 STRONAUT Bot v5.1.0

Bot Discord serba guna untuk gaming komunitas Indonesia — FiveM, SA-MP, Steam, Minecraft & more!

---

## ✨ Fitur Baru v5.1.0

- ✅ **Embed `!player` — Satu embed minimalis & keren** (sebelumnya multi embed)
- ✅ **Support domain + port sebagai endpoint** (e.g. `play.server.com:30120`)
- ✅ **Fix semua command & button yang sebelumnya null/bug**
- ✅ **Web Dashboard** — bisa dihosting bareng bot di VPS/RDP (port 4000)
- ✅ **Direct connect** via IP:port atau domain:port tanpa perlu CFX code

---

## 📦 Instalasi

### Prasyarat
- Node.js 18+ 
- npm / pnpm

### Langkah-langkah

```bash
# 1. Clone / extract folder ini ke VPS/RDP
cd stronaut-bot

# 2. Install dependencies
npm install

# 3. Buat file .env dari template
cp .env.example .env
# (Windows: copy .env.example .env)

# 4. Edit .env — isi token bot, client ID, dll
nano .env

# 5. Jalankan bot
npm start
```

---

## ⚙️ Konfigurasi .env

| Variable | Wajib | Keterangan |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Token bot dari Discord Developer Portal |
| `CLIENT_ID` | ✅ | Application ID bot |
| `GUILD_ID` | ✅ | ID server Discord utama |
| `OWNER_ID` | ✅ | ID Discord owner (untuk command owner-only) |
| `PREFIX` | ❌ | Prefix command (default: `!`) |
| `BOT_NAME` | ❌ | Nama bot (default: `STRONAUT`) |
| `QRIS_IMAGE_URL` | ❌ | URL gambar QRIS untuk donasi |
| `DASHBOARD_PORT` | ❌ | Port dashboard web (default: `4000`) |
| `DASHBOARD_USER` | ❌ | Username dashboard (default: `admin`) |
| `DASHBOARD_PASS` | ❌ | Password dashboard (default: `sBEBAS`) |
| `SNIFOX_API_KEY` | ❌ | API key SnifoxAI untuk fallback AI `!ask` (kosongkan untuk nonaktifkan) |
| `SNIFOX_BASE_URL` | ❌ | Base URL SnifoxAI Gateway (default: `https://core.snifoxai.com/v1`) |
| `SNIFOX_MODEL` | ❌ | Model yang dipakai, cek https://snifoxai.com/models (default: `openai/gpt-4o-mini`) |
| `AI_TIMEOUT` | ❌ | Timeout request AI dalam ms (default: `15000`) |
| `AI_CACHE_TTL` | ❌ | Lama cache jawaban AI di memori, dalam ms (default: `300000`) |
| `ASK_DAILY_LIMIT` | ❌ | Batas TOTAL panggilan fallback AI SnifoxAI per hari (bukan seluruh `!ask`), gabungan semua user, reset 00:00 WIB (default: `50`) |
| `BACKUP_GMAIL_USER` | ❌ | Alamat Gmail pengirim backup seluruh database (aktifkan backup otomatis ke Gmail) |
| `BACKUP_GMAIL_APP_PASSWORD` | ❌ | **App Password** Google 16 karakter (bukan password Gmail biasa; butuh verifikasi 2 langkah) |
| `BACKUP_EMAIL_TO` | ❌ | Gmail tujuan backup (default: sama dengan `BACKUP_GMAIL_USER`) |
| `BACKUP_CHECK_MINUTES` | ❌ | Interval cek perubahan data premium (memicu backup penuh), menit (default: `5`) |
| `BACKUP_FORCE_EVERY_HOURS` | ❌ | Backup penuh berkala walau tidak ada perubahan premium, jam (default: `6`) |

---

## 🌐 Dashboard Web

Dashboard berjalan **satu proses dengan bot**, tidak perlu setup terpisah!

```
https://dashboard.domainkamu.com
# Login memakai DASHBOARD_USER / DASHBOARD_PASS dari .env
```

### Fitur Dashboard:
- 📊 **Overview** — status bot, guilds, users, latency, memory, uptime
- 🎮 **Servers** — tambah/hapus server FiveM via form
- 📬 **Requests** — approve/reject request server dari user Discord
- 🔁 **Active Loops** — monitoring player yang sedang berjalan

---

## 🤖 Command `!ask` & AI Lokal (Opsional)

`!ask <pertanyaan>` adalah asisten tanya-jawab yang **cuma menjawab seputar bot ini** (bukan AI umum) — command, fitur, atau status server yang online.

**Cara kerja (2 lapis):**
1. **Rule-based matching** (selalu aktif, gratis, gak butuh setup apapun, **tanpa limit**) — cocokkan kata kunci pertanyaan ke data asli (database server, daftar command). Contoh: `server yang online hari ini`, `server yang offline`, `player di server satumimpi`.
2. **SnifoxAI** ([snifoxai.com](https://snifoxai.com), fallback kalau lapis 1 gak nemu jawaban) — AI Gateway berbayar, OpenAI-compatible, dikunci ketat cuma boleh jawab seputar bot ini. Jawaban di-cache sementara di memori biar pertanyaan yang sama gak nge-hit API lagi. **Dibatasi `ASK_DAILY_LIMIT` (default 50x/hari, gabungan semua user)** — kalau limit ini abis, pertanyaan yang kejawab lapis 1 tetap jalan normal, cuma fallback AI-nya aja yang berhenti sampai reset jam 00:00 WIB.

### Aktifkan SnifoxAI (opsional)
```bash
# 1. Daftar & buat API key di https://snifoxai.com/dashboard/apikeys

# 2. Edit .env
SNIFOX_API_KEY=snfx-xxxxxxxxxxxxxxxx
SNIFOX_MODEL=openai/gpt-4o-mini   # cek model & harga lain di https://snifoxai.com/models

# 3. Restart bot
pm2 restart stronaut
```
Kalau `SNIFOX_API_KEY` kosong (default) atau SnifoxAI lagi down/error, `!ask` tetap berfungsi normal pakai rule-based matching — bot tidak akan error/crash.

---

## 🎮 Cara Penggunaan Endpoint

Bot sekarang mendukung 3 format endpoint:

| Format | Contoh | Keterangan |
|---|---|---|
| **Alias** | `!cs satumimpi` | Alias dari database |
| **CFX Code** | `!cs abc123` | Kode CFX singkat |
| **IP:Port** | `!cs [HIDDEN]` | Direct connect via IP |
| **Domain:Port** | `!cs play.server.com:30120` | Direct connect via domain |

---

## 📋 Command List

### 🎮 FiveM — Player
| Command | Alias | Keterangan |
|---|---|---|
| `!player <server> <nama>` | `!p`, `!cari` | Cari player by nama — **1 embed minimalis** |
| `!id <server> <id>` | `!pid` | Cari player by Server ID |
| `!allplayer <server>` | `!ap`, `!players` | Semua player online |
| `!loop <server> <nama> [detik]` | `!monitor`, `!track` | Auto monitor player |
| `!stoploop` | `!stoploops`, `!untrack` | Hentikan monitoring |

### 📡 FiveM — Server
| Command | Alias | Keterangan |
|---|---|---|
| `!checkstatus <server>` | `!cs`, `!cek` | Status server online/offline |
| `!serverstatus <server>` | `!ss`, `!serverinfo` | Detail lengkap server |
| `!serverlist` | `!sl`, `!servers` | Daftar server terdaftar |
| `!requestserver <endpoint> <nama>` | `!req` | Request tambah server baru |
| `!setserver <endpoint> <nama> [alias] [banner]` | `!addserver` | Tambah server (owner only) |

### 🎯 Gaming Tools
| Command | Alias | Keterangan |
|---|---|---|
| `!steam <id/url>` | `!sp` | Profil Steam + VAC ban check |
| `!samp <ip> [port]` | `!sa-mp` | Query server SA-MP / Open.MP |
| `!mc <host> [port]` | `!minecraft` | Status server Minecraft |
| `!gameserver <ip> <port> <game>` | `!gs` | Query CS2/Rust/ARK dll |
| `!geoip <ip>` | `!ip` | Lokasi & info IP address |

### 💡 General
| Command | Alias | Keterangan |
|---|---|---|
| `!help` | `!h`, `!menu` | Semua command |
| `!ask <pertanyaan>` | `!tanya`, `!faq` | Tanya apa aja seputar bot ini (command, fitur, server online) |
| `!ping` | `!latency` | Cek latency bot |
| `!bayar` | `!donate` | Donasi via QRIS |
| `!support` | `!discord` | Link support server |
| `!dev` | `!botinfo` | Info dev (owner only) |

---

## 🗂️ Struktur File

```
stronaut-bot/
├── src/
│   ├── index.js                 # Entry point utama
│   ├── config/config.js         # Konfigurasi bot
│   ├── database/db.js           # SQLite database
│   ├── services/fivem/
│   │   ├── serverService.js     # Service status server
│   │   └── playerService.js     # Service cari player
│   ├── utils/embed.js           # Builder embed minimalis
│   ├── commands/                # Semua command
│   │   ├── gaming/             
│   │   ├── general/            
│   │   ├── player/             
│   │   ├── server/             
│   │   └── subscription/       
│   ├── buttons/                 # Handler button interaksi
│   └── dashboard/
│       ├── server.js            # Express dashboard server
│       └── public/index.html    # Dashboard UI
├── env.example                  # Template .env
├── package.json
└── README.md
```

---

## 🔧 PM2 (Rekomendasi untuk VPS/RDP)

```bash
# Install PM2
npm install -g pm2

# Jalankan dengan PM2
pm2 start src/index.js --name stronaut

# Auto-start on reboot
pm2 startup
pm2 save

# Monitor
pm2 logs stronaut
pm2 status
```

---

## 🐛 Known Issues & Fix

| Bug Sebelumnya | Status |
|---|---|
| `!player` kirim 5 embed terpisah | ✅ Fixed — 1 embed minimalis |
| Endpoint hanya support IP:port | ✅ Fixed — support domain:port + CFX |
| Button konfirm/redeem null | ✅ Fixed — handler placeholder |
| Subscription commands null | ✅ Fixed — command bayar aktif |
| Services & utils hilang dari zip | ✅ Fixed — semua file lengkap |

---

Dibuat dengan ❤️ oleh komunitas Indonesia


## 🔐 Production

- Dashboard Express bind ke `127.0.0.1` dan dipublish melalui Nginx + HTTPS.
- `.env` tidak boleh di-commit atau di-upload ke repository publik.
- Ganti token Discord/API key yang pernah terekspos sebelum production.
- Gunakan password dashboard yang panjang dan unik.
- `PUBLIC_SITE_ORIGIN` hanya diperlukan jika website statis terpisah memanggil `/api/public/*`. Jika dashboard dan API berada pada domain yang sama, biarkan kosong.
- Contoh konfigurasi PM2/Nginx ada di folder `deploy/`.

---

## 💎 Premium — Website & Bot Terhubung

Website dan bot memakai **satu database, satu paket, satu poller**:

| Cara beli / aktivasi | Hasilnya |
|---|---|
| `!bayar [paket]` di Discord | Order QRIS → aktif otomatis |
| Halaman `/premium.html` di website | Order QRIS → aktif otomatis di bot |
| Kode redeem (`!redeem` atau kolom *Punya kode redeem?* di website) | Aktif di bot & terlihat di website |
| `!premium give` / panel Admin → Premium | Aktif di bot & terlihat di website |

Semua tersimpan di tabel `guild_subscriptions` (dibaca bot) dan `premium_orders` (riwayat order bot + web).
Paket & fitur diatur sekali di `.env` (`PREMIUM_PLANS`) — lihat `env.lite.example`.
Data dari versi website lama (`premium_subscriptions`, `premium_orders` skema lama) dimigrasi otomatis saat bot pertama kali dijalankan.


Setiap dukungan dan apresiasi dari kalian sangat berarti agar project ini tetap aktif dan terus mendapatkan update! 🙏

📝 Lisensi
Didistribusikan di bawah Lisensi MIT. Bebas digunakan dan dimodifikasi untuk kebutuhan server Anda dengan tetap mencantumkan kredit pembuat asli.
