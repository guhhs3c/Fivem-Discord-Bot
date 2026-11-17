@echo off
rem ============================================================
rem STRONAUT Bot - run-lite.bat  (RDP 2GB / 2 core)
rem - Batasi heap Node (anti bengkak) + restart otomatis kalau crash
rem - Prioritas proses di bawah normal supaya RDP tetap responsif
rem - Tanpa jendela cloudflared terpisah: jalankan cloudflared sebagai
rem   Service Windows (lihat LAPORAN) atau pakai run.bat biasa.
rem ============================================================
cd /d "%~dp0"
set NODE_ENV=production
set RESTART_DELAY=3
:loop
start "" /B /BELOWNORMAL /WAIT node --max-old-space-size=384 --max-semi-space-size=8 src\index.js
if "%errorlevel%"=="0" goto end
echo [run-lite] Bot crash (code %errorlevel%). Restart dalam %RESTART_DELAY% detik...
timeout /t %RESTART_DELAY% /nobreak >nul
if %RESTART_DELAY% LSS 60 set /a RESTART_DELAY=RESTART_DELAY*2
goto loop
:end
pause
