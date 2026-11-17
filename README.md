<div align="center">

# 🤖 FiveM Discord Bot (Stronaut)

**Bot Discord multifungsi untuk manajemen, monitoring status server, dan integrasi komunitas FiveM secara real-time.**

[![GitHub Stars](https://img.shields.io/github/stars/guhhs3c/Fivem-Discord-Bot?style=for-the-badge&logo=github&color=yellow)](https://github.com/guhhs3c/Fivem-Discord-Bot/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/guhhs3c/Fivem-Discord-Bot?style=for-the-badge&logo=github&color=blue)](https://github.com/guhhs3c/Fivem-Discord-Bot/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/guhhs3c/Fivem-Discord-Bot?style=for-the-badge&logo=github&color=red)](https://github.com/guhhs3c/Fivem-Discord-Bot/issues)

[Laporkan Bug](https://github.com/guhhs3c/Fivem-Discord-Bot/issues) • [Request Fitur](https://github.com/guhhs3c/Fivem-Discord-Bot/issues) • [Dukung Project Ini](#-dukung-pengembangan-support)

</div>

---

## ✨ Fitur Utama

- **📊 Real-Time Server Status**: Pantau jumlah pemain online, status server (Online/Offline), dan daftar pemain langsung dari channel Discord.
- **🛡️ Moderasi & Logging**: Sistem pencatatan aktivitas otomatis untuk memudahkan admin memantau server dan Discord.
- **⚡ Performa Ringan & Cepat**: Dibangun dengan struktur modular agar stabil dijalankan 24/7.
- **🔧 Mudah Dikonfigurasi**: Pengaturan terpusat melalui file environment (`.env`) sehingga mudah disesuaikan untuk server mana pun.

---

## 🛠️ Prasyarat (Requirements)

Sebelum menjalankan bot, pastikan perangkat atau VPS Anda sudah terpasang:
- **Node.js 18+** *(sesuaikan dengan bahasa utama bot Anda)*
- Akun **Discord Developer Portal** untuk mendapatkan Bot Token
- Hosting disarankan windows,dan open ip public (untuk gate and dashboard)

---

## 🚀 Cara Instalasi & Penggunaan

1. **Clone repository ini**
   ```bash
   git clone [https://github.com/guhhs3c/Fivem-Discord-Bot.git](https://github.com/guhhs3c/Fivem-Discord-Bot.git)
   cd Fivem-Discord-Bot

💖 Dukung Pengembangan (Support)
Source code ini dibagikan secara gratis (Open Source) untuk membantu komunitas developer dan pemilik server FiveM. Jika project ini bermanfaat bagi server Anda, dukung terus pengembangan fitur-fitur berikutnya dengan cara:

⭐ Berikan Star pada repository ini di pojok kanan atas GitHub!

🍴 Fork & Kontribusi jika Anda ingin menambahkan fitur baru atau memperbaiki bug.

☕ Traktir Kopi / Donasi:

SocialBuzz : https://sociabuzz.com/guhhsec

Discord Community: https://discord.gg/5CPCP5QZPX

Setiap dukungan dan apresiasi dari kalian sangat berarti agar project ini tetap aktif dan terus mendapatkan update! 🙏

📝 Lisensi
Didistribusikan di bawah Lisensi MIT. Bebas digunakan dan dimodifikasi untuk kebutuhan server Anda dengan tetap mencantumkan kredit pembuat asli.

--------------FYI-------------------
# STRONAUT Bot v5.1.0 — Production Environment
# COPY text ini menjadi .env, lalu isi nilai yang benar.
# JANGAN commit/upload .env ke GitHub.

# Discord
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
OWNER_ID=

# AI (opsional jika fitur AI digunakan)
OPENROUTER_API_KEY=REPLACE_WITH_OPENROUTER_KEY

# Bot
BOT_NAME=STRONAUT
BOT_VERSION=5.1.0
PREFIX=!
SUPPORT_SERVER=linkservermu

# Database
DB_PATH=./database.sqlite

# Payment (opsional)
QRIS_IMAGE_URL=
PAYMENT_DURATION_DAYS=30

# FiveM
FIVEM_API_BASE=https://servers-frontend.fivem.net/api/servers/single
FIVEM_API_TIMEOUT=8000

# AI untuk !ask — SnifoxAI Gateway (https://snifoxai.com), OpenAI-compatible.
# Kosongkan SNIFOX_API_KEY untuk nonaktifkan fitur AI (!ask tetap jalan rule-based saja).
SNIFOX_API_KEY=
SNIFOX_BASE_URL=https://core.snifoxai.com/v1
# Cek daftar model & harga di https://snifoxai.com/models, pilih yang cepat/murah.
SNIFOX_MODEL=openai/gpt-5.5
AI_TIMEOUT=45000
AI_CACHE_TTL=300000

# Batas TOTAL panggilan fallback AI SnifoxAI per hari (bukan seluruh !ask), gabungan semua user (reset 00:00 WIB)
ASK_DAILY_LIMIT=50

# Cache (milliseconds)
CACHE_TTL=30000
SERVER_CACHE_TTL=60000

# Loop settings
LOOP_MIN_INTERVAL=30
LOOP_MAX_INTERVAL=3600
ACTIVITY_ROTATE_INTERVAL=15000

# Discord log channel (opsional)
LOG_CHANNEL_ID=channelidlogsservermu

# Dashboard
# Express hanya listen localhost; akses publik melalui Nginx/HTTPS.
DASHBOARD_HOST=127.0.0.1
DASHBOARD_PORT=3000
DASHBOARD_USER=admin
DASHBOARD_PASS=terserahmu

# Jika website publik TERPISAH dari dashboard, isi origin-nya.
# Contoh: https://www.domainkamu.com
# Bisa lebih dari satu, pisahkan koma.
PUBLIC_SITE_ORIGIN=https://www.stronaut.my.id

# --- Pembayaran otomatis (Pakasir) ---
PAKASIR_SLUG=
PAKASIR_API_KEY=

# --- BACKUP  ---
BACKUP_GMAIL_USER=gmailmu
BACKUP_GMAIL_APP_PASSWORD=gmailapppasswordmu
BACKUP_EMAIL_TO=gmailke2
----------------------------------------



BACKUP_EMAIL_TO=gmailke2

BACKUP_GMAIL_APP_PASSWORD=gmailapppasswordmu
BACKUP_EMAIL_TO=gmailke2
