# Step 0: เตรียมเครื่อง

> ก่อนสร้าง Oracle ต้องมีเครื่องมือพร้อมก่อน

## เลือก OS ของคุณ

| OS | สถานะ | คู่มือ |
|----|--------|--------|
| **macOS** | รองรับเต็มที่ | [Setup macOS](00b-setup-mac.md) |
| **Windows** | ต้องใช้ผ่าน WSL | [Setup Windows (WSL)](00a-setup-windows.md) |
| **Linux** | รองรับเต็มที่ | ดูด้านล่าง |

### Windows สำคัญ!

Oracle ทำงานบน **Linux/Unix environment** — Windows ตรงๆ ใช้ไม่ได้

ต้องติดตั้ง **WSL (Windows Subsystem for Linux)** ก่อน:
```powershell
# เปิด PowerShell (Admin) แล้วพิมพ์:
wsl --install
```

อ่าน [Setup Windows (WSL)](00a-setup-windows.md) ทำตาม step by step

### macOS

ติดตั้งง่ายมาก — ใช้ Homebrew:
```bash
brew install git gh tmux
```

อ่าน [Setup macOS](00b-setup-mac.md) ถ้าต้องการรายละเอียด

---

## สิ่งที่ต้องมี (ทุก OS)

### 1. Claude Code (AI Agent)

Claude Code คือ CLI ของ Anthropic — AI agent ที่ทำงานใน terminal ได้

```bash
# ต้องมี Node.js ก่อน
npm install -g @anthropic-ai/claude-code

# ทดสอบ
claude --version
```

ต้องมี [Anthropic API key](https://console.anthropic.com/) หรือ Claude Pro/Max subscription

### 2. Bun (JavaScript Runtime)

Oracle ecosystem ใช้ Bun เป็นหลัก — เร็วกว่า Node.js มาก

```bash
curl -fsSL https://bun.sh/install | bash

# ทดสอบ
bun --version
```

### 3. Git + GitHub CLI

```bash
# Git (ส่วนใหญ่มีอยู่แล้ว)
git --version

# GitHub CLI
# macOS: brew install gh
# Linux: ดู https://cli.github.com/

# Login
gh auth login
```

### 4. tmux (แนะนำ)

สำหรับ run หลาย Oracle พร้อมกัน:

```bash
# macOS
brew install tmux

# Ubuntu/Debian
sudo apt install tmux
```

## ทดสอบทั้งหมด

```bash
claude --version   # Claude Code
bun --version      # Bun runtime
git --version      # Git
gh --version       # GitHub CLI
node --version     # Node.js
tmux -V            # tmux (optional)
```

ถ้าทุกอย่างผ่าน → ไปต่อ

## Structure ที่แนะนำ

```
~/repos/          # หรือ folder ที่ชอบ
└── your-name/
    └── my-oracle/    # Oracle ของคุณจะอยู่ที่นี่
```

---

**ถัดไป**: [Step 1: Oracle คืออะไร?](01-what-is-oracle.md)
