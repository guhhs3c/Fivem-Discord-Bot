@echo off
setlocal enabledelayedexpansion

rem ============================================================
rem STRONAUT Bot — run.bat
rem Menjalankan bot dan otomatis restart jika crash.
rem ============================================================

cd /d "%~dp0"

set RESTART_DELAY=2
set MAX_RESTART_DELAY=60
set RESTART_COUNT=0

echo [run.bat] Memulai STRONAUT Bot...

rem ── Cek Node.js ──────────────────────────────────────────────
where node >nul 2>nul
if errorlevel 1 (
    echo [run.bat] ERROR: Node.js tidak ditemukan. Install Node.js 18+ dulu dari https://nodejs.org
    pause
    exit /b 1
)

rem ── Siapkan .env ──────────────────────────────────────────────
if not exist ".env" (
    if exist "env.example" (
        copy /y "env.example" ".env" >nul
        echo [run.bat] File .env belum ada — dibuat dari env.example.
        echo [run.bat] WAJIB isi DISCORD_TOKEN, CLIENT_ID, GUILD_ID, OWNER_ID di .env sebelum lanjut!
        echo.
        echo Tekan tombol apa saja untuk buka .env di Notepad, lalu jalankan run.bat lagi setelah diisi...
        pause >nul
        notepad ".env"
        exit /b 0
    ) else (
        echo [run.bat] ERROR: .env dan env.example tidak ditemukan.
        pause
        exit /b 1
    )
)

rem ── Install dependencies kalau belum ada ────────────────────────
if not exist "node_modules" (
    echo [run.bat] node_modules tidak ditemukan — menjalankan npm install...
    if exist "package-lock.json" (
        call npm ci || call npm install
    ) else (
        call npm install
    )
    if errorlevel 1 (
        echo [run.bat] ERROR: npm install gagal.
        pause
        exit /b 1
    )
)

rem ── Baca DASHBOARD_PORT dari .env (default 4000) ────────────────
set DASHBOARD_PORT=4000
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /i "%%A"=="DASHBOARD_PORT" if not "%%B"=="" set DASHBOARD_PORT=%%B
)

rem ── Cek DASHBOARD_PASS masih default/kosong ─────────────────────
set DASHBOARD_PASS_OK=1
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /i "%%A"=="DASHBOARD_PASS" (
        if "%%B"=="" set DASHBOARD_PASS_OK=0
        if "%%B"=="REPLACE_WITH_A_LONG_RANDOM_PASSWORD" set DASHBOARD_PASS_OK=0
    )
)
if "%DASHBOARD_PASS_OK%"=="0" (
    echo [run.bat] PERINGATAN: DASHBOARD_PASS di .env masih kosong/default.
    echo [run.bat] Dashboard akan dibuka ke internet lewat tunnel publik di bawah ini —
    echo [run.bat] WAJIB isi DASHBOARD_USER dan DASHBOARD_PASS yang kuat di .env dulu!
    echo.
    pause
)

rem ── Siapkan cloudflared untuk hosting dashboard secara public ───
set "CLOUDFLARED_CMD="
where cloudflared >nul 2>nul
if not errorlevel 1 (
    set "CLOUDFLARED_CMD=cloudflared"
) else (
    if exist "cloudflared.exe" (
        set "CLOUDFLARED_CMD=cloudflared.exe"
    ) else (
        echo [run.bat] cloudflared tidak ditemukan — mengunduh cloudflared.exe...
        powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe' -UseBasicParsing } catch { exit 1 }"
        if exist "cloudflared.exe" (
            set "CLOUDFLARED_CMD=cloudflared.exe"
        ) else (
            echo [run.bat] WARNING: Gagal mengunduh cloudflared. Dashboard hanya bisa diakses lokal ^(http://127.0.0.1:%DASHBOARD_PORT%^).
            echo [run.bat] Coba download manual dari https://github.com/cloudflare/cloudflared/releases lalu taruh cloudflared.exe di folder ini.
        )
    )
)

if defined CLOUDFLARED_CMD (
    echo [run.bat] Membuka dashboard secara public via Cloudflare Tunnel...
    start "STRONAUT Dashboard - Public URL" cmd /k "%CLOUDFLARED_CMD% tunnel --url http://127.0.0.1:%DASHBOARD_PORT%"
    echo [run.bat] URL public akan muncul di jendela "STRONAUT Dashboard - Public URL" ^(baris yang mengandung trycloudflare.com^).
    echo [run.bat] URL ini berubah tiap kali run.bat dijalankan ulang. Tutup jendela itu untuk mematikan akses public.
    echo.
)

echo [run.bat] Starting STRONAUT bot (auto-restart aktif, tutup jendela ini untuk stop)...
echo.

rem ── Loop run + auto-restart ──────────────────────────────────
:runloop
node src\index.js
set EXIT_CODE=%errorlevel%

if "%EXIT_CODE%"=="0" (
    echo [run.bat] Bot berhenti normal ^(exit code 0^). Tidak restart.
    goto :end
)

set /a RESTART_COUNT+=1
echo.
echo [run.bat] Bot crash ^(exit code %EXIT_CODE%^). Restart #%RESTART_COUNT% dalam %RESTART_DELAY% detik...
echo    ^(Tekan Ctrl+C lalu Y untuk berhenti sepenuhnya^)
timeout /t %RESTART_DELAY% /nobreak >nul

set /a RESTART_DELAY=RESTART_DELAY*2
if %RESTART_DELAY% GTR %MAX_RESTART_DELAY% set RESTART_DELAY=%MAX_RESTART_DELAY%

goto :runloop

:end
pause