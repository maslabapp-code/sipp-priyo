@echo off
echo Mencari proses aplikasi SIPP yang sedang jalan (port 3000)...

set FOUND=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Menghentikan proses PID %%a ...
    taskkill /F /PID %%a >nul 2>&1
    set FOUND=1
)

if "%FOUND%"=="1" (
    echo.
    echo Aplikasi sudah dihentikan.
) else (
    echo.
    echo Tidak ada aplikasi yang sedang jalan di port 3000.
)

echo.
pause
