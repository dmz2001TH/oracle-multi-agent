# บทที่ 3: Auto CC Boss

> **Abstract**: สร้างระบบที่ Oracle ทุกตัว cc Boss อัตโนมัติ ผ่าน `maw hey` — เมื่อ session จบ, เมื่อ push code, หรือเมื่อส่งข้อความให้ Oracle อื่น Boss จะรู้ทุกอย่างโดยที่ไม่มีใครต้องจำ

## ทำไม Boss ต้องรู้ทุกอย่าง?

ใน Office ที่มีหลาย Oracle — **Boss คือศูนย์กลาง**

```
Dev ──────┐
Writer ───┤
QA ───────┼──→ Boss → ตัดสินใจ → สั่งงานต่อ
Designer ─┤
Admin ────┘
```

ถ้า Boss ไม่รู้ว่า Dev push code แล้ว → QA ไม่ได้ test → งานค้าง

**กฎ: ถ้า Boss ไม่รู้ — มันไม่ได้เกิดขึ้น**

## maw hey คืออะไร?

`maw hey` คือคำสั่งส่งข้อความระหว่าง Oracle:

```bash
maw hey boss "cc: Dev — push feature-login เสร็จแล้ว"
```

Boss Oracle จะได้รับข้อความนี้ใน session ถัดไป

### รูปแบบ cc

```
maw hey boss "cc: <ชื่อ Oracle> — <สิ่งที่ทำ>"
```

ตัวอย่าง:
- `"cc: Dev — committed fix: login bug"` ← เสร็จงาน
- `"cc: QA — stuck: test database connection failed"` ← ติดปัญหา
- `"cc: Writer — sent draft to Designer for review"` ← ส่งต่อ

## สร้าง Hook: Auto CC เมื่อ Session จบ

นี่คือ hook หลัก — ทุกครั้งที่ Oracle หยุดทำงาน → **บอก Boss อัตโนมัติ**

สร้างไฟล์ `~/.oracle/hooks/cc-boss-on-stop.sh`:

```bash
#!/bin/bash
# cc-boss-on-stop.sh — session จบ → cc Boss อัตโนมัติ

INPUT=$(cat)

# หาชื่อ Oracle จาก folder
CWD="$(pwd)"
ORACLE_NAME=""
if [[ "$CWD" =~ ([^/]+)-[Oo]racle ]]; then
  ORACLE_NAME="${BASH_REMATCH[1]}"
else
  ORACLE_NAME="$(basename "$CWD")"
fi

# ⚠️ ถ้าเราคือ Boss — ไม่ต้อง cc ตัวเอง (วนลูป!)
if [[ "$ORACLE_NAME" =~ ^[Bb]oss$ ]] || [[ "$ORACLE_NAME" =~ ^[Bb]o[Bb]$ ]]; then
  exit 0
fi

# ดู commit ล่าสุด (ภายใน 5 นาที)
RECENT_COMMIT=$(git log --oneline --since="5 minutes ago" -1 2>/dev/null)

# ดูไฟล์ที่เปลี่ยน
STAGED=$(git diff --cached --name-only 2>/dev/null | head -3 | tr '\n' ', ' | sed 's/,$//')
CHANGED=$(git diff --name-only HEAD 2>/dev/null | head -3 | tr '\n' ', ' | sed 's/,$//')

# สร้างสรุป
if [ -n "$RECENT_COMMIT" ]; then
  SUMMARY="committed: $RECENT_COMMIT"
elif [ -n "$STAGED" ]; then
  SUMMARY="staged: $STAGED"
elif [ -n "$CHANGED" ]; then
  SUMMARY="modified: $CHANGED"
else
  SUMMARY="session ended — no changes"
fi

# ส่งข้อความให้ Boss (async — ไม่ block session)
MAW_CLI="/path/to/maw-js/src/cli.ts"
bun "$MAW_CLI" hey boss "cc: ${ORACLE_NAME} — ${SUMMARY}" &>/dev/null &

# แสดงให้คนเห็นว่า cc แล้ว
echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "✅ Auto CC'd Boss — ${ORACLE_NAME}: ${SUMMARY}" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
```

### ทำให้รันได้

```bash
chmod +x ~/.oracle/hooks/cc-boss-on-stop.sh
```

### ลงทะเบียนใน settings.json

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/home/you/.oracle/hooks/cc-boss-on-stop.sh"
          }
        ]
      }
    ]
  }
}
```

## เข้าใจทีละบรรทัด

### ทำไมต้องเช็ค Boss?

```bash
if [[ "$ORACLE_NAME" =~ ^[Bb]oss$ ]]; then
  exit 0
fi
```

ถ้า Boss Oracle ก็มี hook นี้ → Boss จะ cc ตัวเอง → ตัวเองรัน hook → cc ตัวเอง → **วนลูปไม่จบ!**

### ทำไม async (`&`)?

```bash
bun "$MAW_CLI" hey boss "cc: ..." &>/dev/null &
```

- `&>/dev/null` → ไม่แสดง output ของ maw
- `&` (ท้ายสุด) → รันใน background → **ไม่ block** การปิด session

ถ้าไม่ใส่ `&` → session จะรอจนกว่า maw จะส่งเสร็จ (อาจ 2-3 วินาที)

### ทำไมดู commit ก่อน?

```bash
RECENT_COMMIT=$(git log --oneline --since="5 minutes ago" -1 2>/dev/null)
```

ถ้ามี commit → สรุปว่า commit อะไร (มีประโยชน์กว่า "session ended")
ถ้าไม่มี → ดูว่ามีไฟล์ที่เปลี่ยนไหม → ใช้เป็นสรุปแทน

## เพิ่ม Hook: เตือนเมื่อลืม CC Boss

Hook ตัวที่สอง — เมื่อ Oracle ส่ง `maw hey` ให้คนอื่น แต่**ลืม cc Boss**:

สร้างไฟล์ `~/.oracle/hooks/remind-cc-after-maw.sh`:

```bash
#!/bin/bash
# remind-cc-after-maw.sh — ส่ง maw hey ให้คนอื่น แต่ลืม cc Boss → เตือน

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null)

# เฉพาะ Bash tool
[ "$TOOL_NAME" != "Bash" ] && exit 0

# เช็ค: ส่ง maw hey ให้คนอื่น (ไม่ใช่ boss)?
if echo "$COMMAND" | grep -q "maw hey" && ! echo "$COMMAND" | grep -qi "maw hey boss"; then
  echo '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"⚠️ คุณส่ง maw hey ให้ Oracle อื่น — อย่าลืม cc Boss ด้วย! รัน: maw hey boss \"cc: [สรุปสิ่งที่ส่ง]\""}}'
  exit 0
fi

# เช็ค: push code หรือสร้าง PR?
if echo "$COMMAND" | grep -qE "git push|gh pr create"; then
  echo '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"✅ Push/PR สำเร็จ — อย่าลืม cc Boss: maw hey boss \"cc: pushed — [สรุป]\""}}'
  exit 0
fi
```

### ลงทะเบียน

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/home/you/.oracle/hooks/remind-cc-after-maw.sh"
          }
        ]
      }
    ]
  }
}
```

**matcher: `"Bash"`** → hook นี้ทำงานเฉพาะเมื่อ Claude ใช้ Bash tool

## Debounce — ไม่ spam Boss

ปัญหา: ถ้า Oracle ทำ task เสร็จเร็วๆ หลายรอบ → Boss ได้ข้อความ 10 อันใน 5 นาที

แก้: เพิ่ม **debounce** — cc Boss ได้ไม่เกินทุก 60 วินาที

เพิ่มใน `cc-boss-on-stop.sh` ก่อนส่ง maw hey:

```bash
# Debounce: ส่งได้ทุก 60 วินาทีเท่านั้น
LOCK_FILE="/tmp/cc-boss-${ORACLE_NAME}.lock"
if [ -f "$LOCK_FILE" ]; then
  LOCK_AGE=$(( $(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0) ))
  if [ "$LOCK_AGE" -lt 60 ]; then
    exit 0  # ส่งไปแล้วไม่ถึง 60 วิ — ข้าม
  fi
fi
touch "$LOCK_FILE"
```

**วิธีทำงาน**:
1. สร้างไฟล์ `/tmp/cc-boss-dev.lock` เมื่อ cc
2. ครั้งถัดไป → เช็คว่าไฟล์สร้างนานเท่าไหร่
3. ถ้าไม่ถึง 60 วินาที → ข้าม ไม่ cc ซ้ำ
4. ถ้าเกิน 60 วินาที → cc ใหม่ได้

## สรุประบบ Auto CC ทั้งหมด

```
┌──────────────────────────────────────────┐
│ settings.json                            │
├──────────────────────────────────────────┤
│ Stop → cc-boss-on-stop.sh               │
│   • session จบ → สรุปงาน → maw hey boss │
│   • debounce 60 วินาที                    │
│   • ข้าม Boss (ไม่ cc ตัวเอง)              │
│                                          │
│ PostToolUse (Bash) → remind-cc.sh        │
│   • maw hey ไม่ใช่ boss → เตือน           │
│   • git push / PR → เตือน cc boss        │
└──────────────────────────────────────────┘
```

## ลองเอง

1. **สร้าง** `cc-boss-on-stop.sh` → ทดสอบด้วย `echo '{}' | ./script.sh`
2. **ลงทะเบียน** ใน settings.json → ทดสอบใน Claude Code จริง
3. **ดัดแปลง**: เปลี่ยน "boss" เป็นชื่อ Oracle หลักของคุณ
4. **เพิ่ม debounce**: ปรับเวลาจาก 60 วินาทีเป็นอะไรก็ได้ที่เหมาะ

## คำถามที่พบบ่อย

**Q: ถ้ายังไม่มี maw?**
A: ไปเรียน [oracle-maw-guide](https://github.com/the-oracle-keeps-the-human-human/oracle-maw-guide) ก่อน — maw คือระบบส่งข้อความ

**Q: path ของ maw cli อยู่ไหน?**
A: ปกติอยู่ที่ `~/repos/github.com/BankCurfew/maw-js/src/cli.ts` — ดูจาก `which maw` หรือ alias ของคุณ

**Q: ถ้า Boss Oracle ไม่ได้เปิดอยู่?**
A: ไม่เป็นไร! `maw hey` เก็บข้อความไว้ — Boss จะเห็นเมื่อเปิด session ถัดไป

---

> [← บทที่ 2: ตั้ง Hook แรก](02-first-hook.md) | [บทที่ 4: Hook ขั้นสูง →](04-advanced-hooks.md)
