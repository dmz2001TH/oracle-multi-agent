@echo off
chcp 65001 >nul 2>&1
title ARRA Office — Oracle Multi-Agent v5.0

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║  🧠 ARRA Office — Oracle Multi-Agent v5.0    ║
echo  ║  Starting...                                 ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: Check if .env exists
if not exist ".env" (
    echo  ❌ .env not found!
    echo  Run setup.bat first.
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo  📦 Installing dependencies first...
    call npm install
)

:: Create data dir if missing
if not exist "data" mkdir data
if not exist "ψ" mkdir "ψ"

echo  🚀 Launching Oracle Hub...
echo.
echo  📊 Dashboard: http://localhost:3456/dashboard
echo  🌐 App:       http://localhost:3456/app
echo  🔌 API:       http://localhost:3456/api/health
echo.
echo  Press Ctrl+C to stop
echo.

npx tsx src/index.ts

if %errorlevel% neq 0 (
    echo.
    echo  ❌ Hub crashed! Check the error above.
    echo  Common fixes:
    echo    - Check your API key in .env
    echo    - Make sure port 3456 is free
    echo    - Run: npm install
    echo.
    pause
)
