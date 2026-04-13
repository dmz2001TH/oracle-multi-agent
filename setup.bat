@echo off
chcp 65001 >nul 2>&1
title ARRA Office — Oracle Multi-Agent v5.0 Setup

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║  🧠 ARRA Office — Oracle Multi-Agent v5.0    ║
echo  ║  Setup for Windows                           ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ❌ Node.js not found!
    echo  📥 Download from https://nodejs.org/ (v18+)
    echo  Then run this script again.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo  ✅ Node.js %NODE_VERSION% found

:: Check npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  ❌ npm not found! Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo  ✅ npm found

:: Install dependencies
echo.
echo  📦 Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo  ❌ npm install failed!
    pause
    exit /b 1
)

echo  ✅ Dependencies installed

:: Create directories
if not exist "data" mkdir data
if not exist "logs" mkdir logs
if not exist "plugins" mkdir plugins
if not exist "ψ\inbox" mkdir "ψ\inbox"
if not exist "ψ\memory" mkdir "ψ\memory"
if not exist "ψ\writing" mkdir "ψ\writing"
if not exist "ψ\lab" mkdir "ψ\lab"
if not exist "ψ\outbox" mkdir "ψ\outbox"
if not exist "ψ\sessions" mkdir "ψ\sessions"
if not exist "ψ\traces" mkdir "ψ\traces"
if not exist "ψ\threads" mkdir "ψ\threads"
if not exist "logs" mkdir logs
echo  ✅ Directory structure created

:: Create .env if not exists
if not exist ".env" (
    copy ".env.example" ".env"
    echo  ✅ .env created from template
    echo.
    echo  ⚠️  IMPORTANT: Edit .env and add your API key!
    echo     - For Gemini: set GEMINI_API_KEY=your-key
    echo     - For PromptDee: no key needed (free)
    echo.
) else (
    echo  ℹ️  .env already exists, skipping
)

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║  ✅ Setup complete!                          ║
echo  ║                                              ║
echo  ║  Next steps:                                 ║
echo  ║  1. Edit .env → add your API key             ║
echo  ║  2. Double-click start.bat                   ║
echo  ║  3. Open http://localhost:3456/dashboard      ║
echo  ╚══════════════════════════════════════════════╝
echo.
pause
