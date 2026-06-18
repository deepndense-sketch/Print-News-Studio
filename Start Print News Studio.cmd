@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js, then run this file again.
  pause
  exit /b 1
)

start "" cmd /c "timeout /t 1 >nul & start http://localhost:4862"
node server.js
pause
