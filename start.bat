@echo off
title Oracle Multi-Agent Hub
echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║         Oracle Multi-Agent System  v2.1         ║
echo  ╚══════════════════════════════════════════════════╝
echo.

REM Check if .env exists
if not exist .env (
    echo  [!] .env not found! Running setup first...
    echo.
    call "%~dp0setup.bat"
    if not exist .env (
        echo  [X] Setup failed. Please create .env manually.
        pause
        exit /b 1
    )
)

REM Check if node_modules exists
if not exist node_modules (
    echo  [!] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo  [X] npm install failed!
        pause
        exit /b 1
    )
)

echo  [OK] Starting Oracle Hub...
echo  [OK] Dashboard: http://localhost:3456/dashboard
echo.
echo  Press Ctrl+C to stop.
echo.

node src/hub/index.js
pause
