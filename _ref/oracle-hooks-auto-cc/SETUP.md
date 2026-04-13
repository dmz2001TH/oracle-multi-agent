# Quick Setup — ให้ Claude ช่วยติดตั้งให้

> ไม่ต้องอ่านทุกบท — copy ข้อความด้านล่างแล้วส่งให้ Claude Code ได้เลย

## วิธีที่ 1: บอก Claude ทำให้ทั้งหมด

เปิด Claude Code ใน Oracle repo ของคุณ แล้ว paste:

```
Help me set up auto-cc hooks for my Oracle. I want:

1. When my Oracle session ends → automatically send "maw hey boss" to notify
   my Boss Oracle what I did (commit summary or file changes)
2. When I send "maw hey" to another Oracle but forget to cc Boss → remind me
3. When context window reaches 80% → warn me to run /rrr

My setup:
- Boss Oracle name: [ใส่ชื่อ Boss ของคุณ เช่น "boss" หรือ "bob"]
- maw cli path: [ใส่ path เช่น ~/maw-js/src/cli.ts หรือ which maw]

Please:
- Create the hook scripts in ~/.oracle/hooks/
- Add them to ~/.claude/settings.json
- Test each hook with echo '{}' | ./script.sh
```

Claude จะ:
1. สร้าง 3 สคริปต์ใน `~/.oracle/hooks/`
2. แก้ `~/.claude/settings.json` ให้
3. ทดสอบให้

## วิธีที่ 2: ติดตั้งเอง (5 นาที)

### 1. Copy scripts

```bash
mkdir -p ~/.oracle/hooks

# copy จาก examples
cp examples/cc-boss-on-stop.sh ~/.oracle/hooks/
cp examples/remind-cc-after-maw.sh ~/.oracle/hooks/
cp examples/context-warning.sh ~/.oracle/hooks/

# ทำให้รันได้
chmod +x ~/.oracle/hooks/*.sh
```

### 2. แก้ตัวแปร

เปิดแต่ละไฟล์แล้วแก้:

```bash
# cc-boss-on-stop.sh — บรรทัดบน
BOSS_NAME="boss"           # ← เปลี่ยนเป็นชื่อ Boss ของคุณ
MAW_CLI="$HOME/maw-js/src/cli.ts"  # ← เปลี่ยนเป็น path ของ maw
```

หรือตั้ง environment variable:

```bash
export BOSS_NAME="bob"
export MAW_CLI="$HOME/repos/maw-js/src/cli.ts"
```

### 3. ลงทะเบียน hooks

```bash
# ถ้ายังไม่มี settings.json
cp examples/settings.json ~/.claude/settings.json

# ถ้ามีอยู่แล้ว — ให้ Claude ช่วย merge:
# "Help me add these hooks to my existing ~/.claude/settings.json"
```

**สำคัญ**: เปลี่ยน `/home/you/` ใน settings.json เป็น home directory จริง

### 4. ทดสอบ

```bash
# ทดสอบ cc boss
echo '{}' | ~/.oracle/hooks/cc-boss-on-stop.sh

# ทดสอบ remind cc
echo '{"tool_name":"Bash","tool_input":{"command":"maw hey dev hello"}}' | ~/.oracle/hooks/remind-cc-after-maw.sh

# ทดสอบ context warning (ต้องมี statusline file)
~/.oracle/hooks/context-warning.sh
```

### 5. เปิด Claude Code แล้วใช้งานจริง

```bash
cd ~/your-oracle-repo
claude
```

ลองทำงานอะไรก็ได้ แล้วดูว่า hook ทำงานไหม

## ปรับแต่ง

| ต้องการ | แก้ตรงไหน |
|---------|----------|
| เปลี่ยนชื่อ Boss | `BOSS_NAME` ใน cc-boss-on-stop.sh |
| ปรับ debounce | เปลี่ยน `60` ใน cc-boss-on-stop.sh |
| ปิด context warning | ลบ context-warning entry จาก settings.json |
| เพิ่ม hook ใหม่ | สร้าง .sh → ลงทะเบียนใน settings.json |

## มีปัญหา?

| ปัญหา | แก้ |
|-------|-----|
| hook ไม่ทำงาน | เช็ค `chmod +x` แล้วหรือยัง? |
| path ผิด | ใช้ absolute path เสมอ (ไม่ใช่ `~/`) ใน settings.json |
| maw ส่งไม่ได้ | เช็ค maw server: `maw status` |
| settings.json syntax error | ใช้ `jq . ~/.claude/settings.json` เช็ค |

---

เปิด [Discussion](../../discussions) ถ้ามีคำถาม
