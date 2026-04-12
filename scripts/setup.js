#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

console.log('🧠 Oracle Multi-Agent Setup\n');

// Check Node.js version
const nodeVersion = parseInt(process.version.replace('v', '').split('.')[0]);
if (nodeVersion < 18) {
  console.error('❌ Node.js 18+ required. Current:', process.version);
  process.exit(1);
}
console.log(`✅ Node.js ${process.version}`);

// Create directories
const dirs = ['data', 'logs', 'config'];
for (const dir of dirs) {
  const path = join(ROOT, dir);
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
    console.log(`📁 Created ${dir}/`);
  }
}

// Create .env if not exists
const envPath = join(ROOT, '.env');
if (!existsSync(envPath)) {
  const envExample = join(ROOT, '.env.example');
  if (existsSync(envExample)) {
    copyFileSync(envExample, envPath);
    console.log('📄 Created .env from .env.example');
    console.log('⚠️  Edit .env and add your GEMINI_API_KEY!');
  }
}

// Install dependencies
console.log('\n📦 Installing dependencies...');
try {
  execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
  console.log('✅ Dependencies installed');
} catch (err) {
  console.error('❌ npm install failed. Try: cd oracle-multi-agent && npm install');
  process.exit(1);
}

// Check .env for API key
const { readFileSync } = await import('fs');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  if (envContent.includes('your-api-key-here') || !envContent.includes('GEMINI_API_KEY=')) {
    console.log('\n⚠️  GEMINI_API_KEY not set!');
    console.log('   1. Go to https://aistudio.google.com/apikey');
    console.log('   2. Create an API key');
    console.log('   3. Edit .env and set GEMINI_API_KEY=your-actual-key');
  } else {
    console.log('✅ GEMINI_API_KEY found in .env');
  }
} catch {}

// Create Windows batch files
const startBat = `@echo off
title Oracle Multi-Agent Hub
echo Starting Oracle Multi-Agent Hub...
node src/hub/index.js
pause`;
writeFileSync(join(ROOT, 'start.bat'), startBat);
console.log('📄 Created start.bat');

const setupBat = `@echo off
title Oracle Setup
node scripts/setup.js
pause`;
writeFileSync(join(ROOT, 'setup.bat'), setupBat);
console.log('📄 Created setup.bat');

console.log('\n🎉 Setup complete!\n');
console.log('Quick start:');
console.log('  1. Edit .env → add your GEMINI_API_KEY');
console.log('  2. Run: npm start  (or double-click start.bat)');
console.log('  3. Open: http://localhost:3456/dashboard');
console.log('  4. Spawn an agent and start chatting!\n');
console.log('For WSL2 (recommended):');
console.log('  wsl --install');
console.log('  # Then in WSL terminal:');
console.log('  cd /mnt/c/Users/YourName/path/to/oracle-multi-agent');
console.log('  npm install && npm start\n');
