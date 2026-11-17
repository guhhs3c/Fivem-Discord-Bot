#!/usr/bin/env bash
# ============================================================
# STRONAUT Bot — run.sh
# Menjalankan bot dan otomatis restart jika crash.
# ============================================================

set -uo pipefail

# Selalu jalan dari folder tempat script ini berada
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MAX_RESTART_DELAY=60   # detik, batas atas delay sebelum restart
RESTART_DELAY=2        # delay awal (detik), naik tiap crash beruntun
RESTART_COUNT=0

log() {
  echo "[run.sh] $(date '+%Y-%m-%d %H:%M:%S') — $*"
}

# ── Cek Node.js ──────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  echo "[run.sh] ERROR: Node.js tidak ditemukan. Install Node.js 18+ dulu." >&2
  exit 1
fi

# ── Siapkan .env ──────────────────────────────────────────────
if [ ! -f ".env" ]; then
  if [ -f "env.example" ]; then
    cp env.example .env
    log "File .env belum ada — dibuat dari env.example."
    log "⚠️  WAJIB isi DISCORD_TOKEN, CLIENT_ID, GUILD_ID, OWNER_ID di .env sebelum lanjut!"
  else
    echo "[run.sh] ERROR: .env dan env.example tidak ditemukan." >&2
    exit 1
  fi
fi

# ── Install dependencies kalau belum ada / package.json berubah ──
NEED_INSTALL=0
if [ ! -d "node_modules" ]; then
  NEED_INSTALL=1
elif [ "package.json" -nt "node_modules" ]; then
  NEED_INSTALL=1
fi

if [ "$NEED_INSTALL" -eq 1 ]; then
  log "Menjalankan npm install..."
  if [ -f "package-lock.json" ]; then
    npm ci || npm install
  else
    npm install
  fi
  if [ $? -ne 0 ]; then
    echo "[run.sh] ERROR: npm install gagal." >&2
    exit 1
  fi
fi

# ── Trap agar Ctrl+C / stop mematikan proses bot dengan bersih ──
CHILD_PID=""
cleanup() {
  log "Menghentikan bot..."
  if [ -n "$CHILD_PID" ] && kill -0 "$CHILD_PID" 2>/dev/null; then
    kill -TERM "$CHILD_PID" 2>/dev/null
    wait "$CHILD_PID" 2>/dev/null
  fi
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── Loop run + auto-restart ──────────────────────────────────
log "Starting STRONAUT bot (auto-restart aktif, Ctrl+C untuk stop)..."

while true; do
  node src/index.js &
  CHILD_PID=$!
  wait "$CHILD_PID"
  EXIT_CODE=$?
  CHILD_PID=""

  if [ "$EXIT_CODE" -eq 0 ]; then
    log "Bot berhenti normal (exit code 0). Tidak restart."
    break
  fi

  RESTART_COUNT=$((RESTART_COUNT + 1))
  log "Bot crash (exit code $EXIT_CODE). Restart #$RESTART_COUNT dalam ${RESTART_DELAY}s..."
  sleep "$RESTART_DELAY"

  # Exponential backoff, dibatasi MAX_RESTART_DELAY
  RESTART_DELAY=$((RESTART_DELAY * 2))
  if [ "$RESTART_DELAY" -gt "$MAX_RESTART_DELAY" ]; then
    RESTART_DELAY=$MAX_RESTART_DELAY
  fi
done
