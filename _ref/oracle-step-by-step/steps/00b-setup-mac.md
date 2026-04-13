# Setup: macOS

> macOS พร้อมใช้งาน Oracle ได้เลย — ติดตั้ง tools ไม่กี่ตัวก็เริ่มได้

## ทำไม macOS ง่าย?

- macOS เป็น Unix-based → tools ทำงานได้ native
- มี Terminal มาให้แล้ว
- Homebrew ทำให้ติดตั้งทุกอย่างง่าย

## Step 1: ติดตั้ง Homebrew

Homebrew คือ package manager สำหรับ macOS — ใช้ติดตั้งทุกอย่าง

```bash
# เปิด Terminal (Cmd + Space → พิมพ์ "Terminal")
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

หลังติดตั้ง ทำตาม instructions ที่ขึ้นมา (มักจะต้อง add PATH):

```bash
# สำหรับ Apple Silicon (M1/M2/M3/M4)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"

# สำหรับ Intel Mac
echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/usr/local/bin/brew shellenv)"
```

ทดสอบ:
```bash
brew --version
```

## Step 2: ติดตั้ง Tools

### ติดตั้งทุกอย่างในคำสั่งเดียว

```bash
# Git, GitHub CLI, tmux
brew install git gh tmux

# Node.js (ผ่าน nvm — แนะนำ)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.zshrc
nvm install --lts

# Bun
curl -fsSL https://bun.sh/install | bash
source ~/.zshrc

# Claude Code
npm install -g @anthropic-ai/claude-code
```

### หรือทีละตัว

#### Git

```bash
# macOS มี git มาให้แล้ว แต่ version อาจเก่า
git --version

# ถ้าอยากได้ version ใหม่:
brew install git
```

#### GitHub CLI

```bash
brew install gh
gh auth login
```

#### Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.zshrc
bun --version
```

#### Node.js + Claude Code

```bash
# ติดตั้ง nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.zshrc

# ติดตั้ง Node.js LTS
nvm install --lts

# Claude Code
npm install -g @anthropic-ai/claude-code
claude --version
```

#### tmux

```bash
brew install tmux
```

## Step 3: ตั้งค่า Git

```bash
git config --global user.name "ชื่อของคุณ"
git config --global user.email "email@example.com"
```

## Step 4: สร้าง Workspace

```bash
mkdir -p ~/repos
cd ~/repos
```

## Tips สำหรับ macOS

### Terminal ที่แนะนำ

macOS มี Terminal.app มาให้ แต่มีตัวเลือกที่ดีกว่า:

- **iTerm2** (ฟรี) — tabs, split panes, search
  ```bash
  brew install --cask iterm2
  ```
- **Warp** (ฟรี) — modern terminal พร้อม AI features
- **Alacritty** — เร็วมาก (GPU-accelerated)

### Shell

macOS ใช้ **zsh** เป็น default — ดีอยู่แล้ว ไม่ต้องเปลี่ยน

แนะนำเพิ่ม Oh My Zsh (optional):
```bash
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

### Keyboard Shortcuts

| Shortcut | ทำอะไร |
|----------|--------|
| `Cmd + Space` | Spotlight — เปิด Terminal |
| `Cmd + T` | New tab ใน Terminal |
| `Ctrl + C` | หยุด process |
| `Ctrl + R` | Search command history |
| `Ctrl + A` | ไปต้นบรรทัด |
| `Ctrl + E` | ไปท้ายบรรทัด |

### Apple Silicon (M1/M2/M3/M4)

Tools ทั้งหมดรองรับ Apple Silicon — ไม่ต้องกังวล
- Bun: native ARM64
- Node.js: native ARM64
- Claude Code: ทำงานผ่าน Node.js

## ทดสอบทั้งหมด

```bash
claude --version   # Claude Code
bun --version      # Bun runtime
git --version      # Git
gh --version       # GitHub CLI
node --version     # Node.js
tmux -V            # tmux
```

ถ้าทุกอย่างผ่าน → กลับไป [Step 0](00-prerequisites.md) แล้วไปต่อ Step 1

## Troubleshooting

### "command not found" หลังติดตั้ง

```bash
# reload shell config
source ~/.zshrc
```

### Homebrew ช้า

```bash
# ใช้ mirror ที่เร็วกว่า (ถ้าอยู่ไทย)
export HOMEBREW_BOTTLE_DOMAIN=https://mirrors.ustc.edu.cn/homebrew-bottles
```

### Permission denied

```bash
# ถ้า npm install -g ไม่ได้
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
```

### Xcode Command Line Tools

บาง tools ต้องการ Xcode CLT:
```bash
xcode-select --install
```

---

**กลับไป**: [Step 0: เตรียมเครื่อง](00-prerequisites.md)
