# บทที่ 2: ตั้ง Hook แรก

> **Abstract**: สร้าง hook ตัวแรกที่ใช้งานได้จริง — เมื่อ session จบ ให้พิมพ์สรุปว่า Oracle ทำอะไรไป ก่อนจะต่อยอดเป็นระบบ auto-cc ในบทถัดไป

## เป้าหมาย

สร้าง hook ที่ทำสิ่งนี้:

```
Claude ทำงานเสร็จ (Stop event)
        │
        ▼
   hook รันอัตโนมัติ
        │
        ▼
   พิมพ์ว่า Oracle ทำอะไรไป (git status)
```

ง่ายมาก แต่จะเป็นฐานสำหรับทุกอย่างที่ตามมา

## ขั้นที่ 1: สร้างโฟลเดอร์สำหรับ hook

```bash
mkdir -p ~/.oracle/hooks
```

ใส่ hook ทั้งหมดไว้ที่เดียว — ง่ายต่อการจัดการ

## ขั้นที่ 2: เขียน hook script

สร้างไฟล์ `~/.oracle/hooks/session-summary.sh`:

```bash
#!/bin/bash
# session-summary.sh — สรุปสิ่งที่เปลี่ยนเมื่อ session จบ

# อ่าน input จาก Claude Code (ทุก hook ได้ JSON ผ่าน stdin)
INPUT=$(cat)

# หา Oracle name จาก folder ที่ทำงานอยู่
CWD="$(pwd)"
if [[ "$CWD" =~ ([^/]+)-[Oo]racle ]]; then
  ORACLE_NAME="${BASH_REMATCH[1]}"
else
  ORACLE_NAME="$(basename "$CWD")"
fi

# ดูว่ามี commit ล่าสุดใน 5 นาทีไหม
RECENT_COMMIT=$(git log --oneline --since="5 minutes ago" -1 2>/dev/null)

# ดูว่ามีไฟล์ที่เปลี่ยนไหม
CHANGED=$(git diff --name-only HEAD 2>/dev/null | head -3 | tr '\n' ', ' | sed 's/,$//')

# สรุป
echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo " Session Summary — ${ORACLE_NAME}" >&2
if [ -n "$RECENT_COMMIT" ]; then
  echo " Committed: ${RECENT_COMMIT}" >&2
elif [ -n "$CHANGED" ]; then
  echo " Modified: ${CHANGED}" >&2
else
  echo " No changes" >&2
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2
```

ทำให้รันได้:

```bash
chmod +x ~/.oracle/hooks/session-summary.sh
```

## ขั้นที่ 3: ลงทะเบียน hook ใน settings.json

เปิด `~/.claude/settings.json` แล้วเพิ่ม:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/home/you/.oracle/hooks/session-summary.sh"
          }
        ]
      }
    ]
  }
}
```

**สำคัญ**: เปลี่ยน `/home/you/` เป็น home directory ของคุณจริงๆ

## ขั้นที่ 4: ทดสอบ

### ทดสอบ script โดยตรง

```bash
echo '{}' | ~/.oracle/hooks/session-summary.sh
```

ควรเห็น:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Session Summary — your-folder-name
 No changes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### ทดสอบกับ Claude Code จริง

1. เปิด Claude Code ใน terminal
2. พิมพ์อะไรก็ได้ เช่น "hi"
3. เมื่อ Claude ตอบเสร็จ → ดูว่ามี summary ขึ้นมาไหม

## เข้าใจ Flow

```
User: "hi"
  │
  ▼
Claude: "สวัสดีครับ"
  │
  ▼
Claude หยุด (Stop event)
  │
  ▼
Claude Code ดู settings.json
  → มี hook สำหรับ Stop ไหม?
  → มี! → รัน session-summary.sh
  │
  ▼
session-summary.sh รัน:
  1. อ่าน stdin (JSON)
  2. หาชื่อ Oracle จาก folder
  3. ดู git status
  4. พิมพ์สรุปออก stderr
  │
  ▼
User เห็นสรุปใน terminal
```

## ทำไม stderr ไม่ใช่ stdout?

```bash
echo "ข้อความ" >&2    # stderr — แสดงบน terminal ให้คนเห็น
echo '{"json"}'        # stdout — ส่งกลับให้ Claude Code อ่าน
```

- **stderr** (`>&2`) → แสดงบนหน้าจอ — สำหรับมนุษย์
- **stdout** → Claude Code อ่าน — สำหรับส่ง feedback กลับ

ถ้าพิมพ์ข้อความธรรมดาออก stdout → Claude Code จะพยายามอ่านเป็น JSON → error

## สิ่งที่ได้เรียน

| concept | หมายถึง |
|---------|--------|
| hook script | ไฟล์ .sh ที่ hook เรียก |
| chmod +x | ทำให้ script รันได้ |
| settings.json | ลงทะเบียน hook |
| stdin | ข้อมูลที่ hook ได้รับ |
| stderr vs stdout | แสดงผล vs ส่งกลับ Claude |

## ลองเอง

1. **ดัดแปลง** script ให้แสดงเวลาปัจจุบันด้วย (`date`)
2. **เพิ่ม** ให้แสดง branch ปัจจุบัน (`git branch --show-current`)
3. **ทดสอบ** ใน Oracle repo ของตัวเอง

---

> [← บทที่ 1: Hook คืออะไร](01-what-is-hook.md) | [บทที่ 3: Auto CC Boss →](03-auto-cc-boss.md)
