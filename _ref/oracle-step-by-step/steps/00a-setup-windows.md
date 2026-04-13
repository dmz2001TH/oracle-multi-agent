# Setup: Windows (ผ่าน WSL)

> Oracle ทำงานบน Linux environment — Windows ต้องใช้ WSL (Windows Subsystem for Linux)

## ทำไมต้อง WSL?

Oracle ecosystem (Claude Code, Bun, oracle-v2) ออกแบบมาสำหรับ Unix-based OS
- **Windows ตรงๆ ไม่ได้** — หลาย tools ไม่รองรับ
- **WSL = Linux ใน Windows** — ได้ terminal เต็มรูปแบบ ทำงานได้ 100%
- **แนะนำ WSL 2** — เร็วกว่า WSL 1 มาก

## Step 1: เปิด WSL

### เปิด PowerShell (Admin)

กด `Win + X` → เลือก **Terminal (Admin)** หรือ **PowerShell (Admin)**

```powershell
# ติดตั้ง WSL + Ubuntu (ครั้งเดียว)
wsl --install
```

รอจนเสร็จ แล้ว **restart เครื่อง**

### หลัง Restart

WSL จะเปิดขึ้นมาให้ตั้ง username + password

```
Enter new UNIX username: [ใส่ชื่อ]
New password: [ใส่รหัส]
```

### เช็คว่าทำงาน

```powershell
# ใน PowerShell
wsl --list --verbose
```

ควรเห็น:
```
  NAME      STATE           VERSION
* Ubuntu    Running         2
```

## Step 2: เข้า WSL

```powershell
# เข้า Ubuntu
wsl
```

จากนี้ทำทุกอย่างใน WSL terminal

## Step 3: ติดตั้ง Tools ใน WSL

### Update Ubuntu

```bash
sudo apt update && sudo apt upgrade -y
```

### Git (มักมีอยู่แล้ว)

```bash
git --version
# ถ้าไม่มี:
sudo apt install git -y
```

### Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

### Node.js + npm (สำหรับ Claude Code)

```bash
# ติดตั้ง nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc

# ติดตั้ง Node.js LTS
nvm install --lts
node --version
npm --version
```

### Claude Code

```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

### GitHub CLI

```bash
# ติดตั้ง
(type -p wget >/dev/null || (sudo apt update && sudo apt-get install wget -y)) \
  && sudo mkdir -p -m 755 /etc/apt/keyrings \
  && out=$(mktemp) && wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  && cat $out | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
  && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && sudo apt update \
  && sudo apt install gh -y

# Login
gh auth login
```

### tmux

```bash
sudo apt install tmux -y
```

## Step 4: ตั้งค่า Git

```bash
git config --global user.name "ชื่อของคุณ"
git config --global user.email "email@example.com"
```

## Step 5: สร้าง Workspace

```bash
# สร้าง folder สำหรับ projects
mkdir -p ~/repos
cd ~/repos
```

## Tips สำหรับ Windows + WSL

### เปิด File Explorer จาก WSL

```bash
# เปิด folder ปัจจุบันใน Windows Explorer
explorer.exe .
```

### เข้าถึงไฟล์ WSL จาก Windows

ใน File Explorer พิมพ์: `\\wsl$\Ubuntu\home\[username]\`

### ใช้ VS Code กับ WSL

```bash
# ติดตั้ง VS Code บน Windows ก่อน
# แล้วใน WSL:
code .
```

VS Code จะเปิด remote connection เข้า WSL อัตโนมัติ

### Copy/Paste ใน Terminal

- **Copy**: เลือกข้อความ → `Ctrl + Shift + C`
- **Paste**: `Ctrl + Shift + V`

### Performance Tips

- **เก็บ project ใน WSL filesystem** (`~/repos/`) ไม่ใช่ใน `/mnt/c/`
  - `/mnt/c/` = Windows filesystem → **ช้ามาก**
  - `~/` = WSL filesystem → **เร็วปกติ**
- **ปิด Windows Defender scanning สำหรับ WSL paths** (ถ้าช้า):
  - Windows Security → Virus & threat protection → Manage settings
  - Exclusions → Add: `\\wsl$\Ubuntu`

### Windows Terminal แนะนำ

ถ้ายังใช้ cmd.exe อยู่ → ติดตั้ง [Windows Terminal](https://aka.ms/terminal) จาก Microsoft Store
- มี tabs
- รองรับ WSL, PowerShell, cmd ในที่เดียว
- สวยกว่าเยอะ

## ทดสอบทั้งหมด

```bash
# ใน WSL
claude --version   # Claude Code
bun --version      # Bun runtime
git --version      # Git
gh --version       # GitHub CLI
node --version     # Node.js
tmux -V            # tmux
```

ถ้าทุกอย่างผ่าน → กลับไป [Step 0](00-prerequisites.md) แล้วไปต่อ Step 1

## Troubleshooting

### WSL ติดตั้งไม่ได้

```powershell
# เปิด features ที่จำเป็น (PowerShell Admin)
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
# Restart เครื่อง แล้วลองใหม่
```

### WSL 1 อยากอัพเป็น WSL 2

```powershell
wsl --set-version Ubuntu 2
```

### Bun ไม่เจอหลังติดตั้ง

```bash
source ~/.bashrc
# หรือเพิ่มใน .bashrc:
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

### Claude Code ไม่ทำงาน

ตรวจสอบว่า Node.js ติดตั้งถูก:
```bash
which node    # ควรเห็น path
which claude  # ควรเห็น path
```

---

**กลับไป**: [Step 0: เตรียมเครื่อง](00-prerequisites.md)
