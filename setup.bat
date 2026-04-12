@echo off
title Oracle Multi-Agent Setup
echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║         Oracle Multi-Agent Setup  v2.1          ║
echo  ╚══════════════════════════════════════════════════╝
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  [X] Node.js not found! Download from https://nodejs.org/
    echo      Recommended: Node.js 18+ LTS
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo  [OK] Node.js %NODE_VER%

REM Create directories
if not exist data mkdir data
if not exist logs mkdir data
echo  [OK] Directories ready

REM Create .env from .env.example
if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo  [OK] Created .env from .env.example
        echo.
        echo  ════════════════════════════════════════════════
        echo   IMPORTANT: Edit .env and add your API key!
        echo  ════════════════════════════════════════════════
        echo.
        echo   LLM_PROVIDER=promptdee  (or gemini)
        echo   GEMINI_API_KEY=your-key-here
        echo.
        echo   Get Gemini key: https://aistudio.google.com/apikey
        echo   Free tier: 60 requests/min — plenty for 3-5 agents
        echo.
    ) else (
        echo  [!] .env.example not found, creating default .env
        echo LLM_PROVIDER=promptdee> .env
        echo GEMINI_API_KEY=>> .env
        echo HUB_PORT=3456>> .env
        echo DB_PATH=./data/oracle.db>> .env
    )
) else (
    echo  [OK] .env already exists
)

REM Install dependencies
echo  [..] Installing dependencies...
call npm install
if errorlevel 1 (
    echo  [X] npm install failed!
    echo      Try: npm install --force
    pause
    exit /b 1
)
echo  [OK] Dependencies installed

echo.
echo  ════════════════════════════════════════════════
echo   Setup complete!
echo  ════════════════════════════════════════════════
echo.
echo   1. Edit .env and add your API key
echo   2. Double-click start.bat (or run: npm start)
echo   3. Open http://localhost:3456/dashboard
echo   4. Click "+ New" to spawn an agent
echo   5. Chat with your agent!
echo.
echo   Available agent roles:
echo     🤖 General     - All-purpose assistant
echo     🔬 Researcher   - Analysis & patterns
echo     💻 Coder        - Write & debug code
echo     ✍️  Writer       - Docs & content
echo     👔 Manager      - Coordinate agents
echo.
echo   CLI commands (after starting the hub):
echo     node bin/oracle status
echo     node bin/oracle chat Neo "hello"
echo     node bin/oracle team spawn
echo.
pause
