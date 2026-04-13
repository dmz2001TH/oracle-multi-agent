#!/usr/bin/env bash
set -e

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║  🧠 ARRA Office — Oracle Multi-Agent v5.0    ║"
echo "  ║  Setup for Linux / macOS                     ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "  ❌ Node.js not found!"
  echo "  📥 Download from https://nodejs.org/ (v20+)"
  exit 1
fi

NODE_VERSION=$(node -v)
echo "  ✅ Node.js $NODE_VERSION found"

# Check npm
if ! command -v npm &>/dev/null; then
  echo "  ❌ npm not found!"
  exit 1
fi
echo "  ✅ npm found"

# Install dependencies
echo ""
echo "  📦 Installing dependencies..."
npm install
echo "  ✅ Dependencies installed"

# Create directories
mkdir -p data logs plugins
mkdir -p ψ/inbox ψ/memory ψ/writing ψ/lab ψ/outbox ψ/sessions ψ/traces ψ/threads
echo "  ✅ Directory structure created"

# Create .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  ✅ .env created from template"
  echo ""
  echo "  ⚠️  IMPORTANT: Edit .env and add your API key!"
  echo "     - For Gemini: set GEMINI_API_KEY=your-key"
  echo "     - For PromptDee: no key needed (free)"
else
  echo "  ℹ️  .env already exists, skipping"
fi

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║  ✅ Setup complete!                          ║"
echo "  ║                                              ║"
echo "  ║  Next steps:                                 ║"
echo "  ║  1. Edit .env → add your API key             ║"
echo "  ║  2. Run: npm start                           ║"
echo "  ║  3. Open http://localhost:3456/health         ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""
