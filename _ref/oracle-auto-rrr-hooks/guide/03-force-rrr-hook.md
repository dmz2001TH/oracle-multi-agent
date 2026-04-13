# Chapter 3: force-rrr-at-80.sh — อธิบายทีละบรรทัด

## ภาพรวม

```
PostToolUse event
      ↓
อ่าน statusline JSON → ดึง context %
      ↓
  80%+ → 🚨 EMERGENCY (auto-compact กำลังจะมา!)
  70%+ → ⚠️ WARNING (เตรียมตัว /rrr + /forward)
  <70% → ไม่ทำอะไร
```

### ทำไม 70/80 ไม่ใช่ 80/90?

Claude Code จะ auto-compact (ตัดข้อมูลเก่าทิ้ง) ที่ ~80% ถ้ารอถึง 80% แล้วค่อยเตือน → สายเกินไป compact ไปแล้ว เราจึง:
- **เตือนที่ 70%** → มีเวลา wrap up (~20K tokens เหลือ)
- **บังคับที่ 80%** → compact กำลังจะเริ่ม ต้อง /rrr เดี๋ยวนี้

> ปรับได้: แก้ `WARN_THRESHOLD` และ `FORCE_THRESHOLD` ที่บรรทัดบนสุดของ script

## Code Walkthrough

### ส่วน 1: หาไฟล์ Statusline

```bash
STATUSLINE_JSON="${TMPDIR:-${TMP:-${TEMP:-/tmp}}}/statusline-raw.json"
[ ! -f "$STATUSLINE_JSON" ] && exit 0
```

**อธิบาย**:
- `TMPDIR` คือ temp directory ของระบบ (Linux = `/tmp`, macOS อาจเป็น `/var/folders/...`)
- `${TMPDIR:-${TMP:-${TEMP:-/tmp}}}` = ลอง TMPDIR ก่อน, ถ้าไม่มีลอง TMP, TEMP, สุดท้ายใช้ /tmp
- ถ้ายังไม่มีไฟล์ → statusline.sh ยังไม่เคยรัน → ข้าม (exit 0 = ปกติ)

**ทำไมไม่ hardcode /tmp?**
เพราะ macOS ไม่ใช้ /tmp เสมอ และ container environments อาจตั้ง TMPDIR ต่างกัน

### ส่วน 2: อ่าน Context %

```bash
PCT=$(python3 -c "
import json
with open('$STATUSLINE_JSON') as f:
    d = json.load(f)
print(d.get('context_window',{}).get('used_percentage', 0))
" 2>/dev/null)
[ -z "$PCT" ] && exit 0
```

**อธิบาย**:
- ใช้ Python อ่าน JSON เพราะ `jq` อาจไม่มี (Python มาพร้อมระบบเกือบทุกตัว)
- `d.get('context_window',{}).get('used_percentage', 0)` = safe access, ไม่ error ถ้า key ไม่มี
- `2>/dev/null` = ซ่อน error (ถ้า JSON เสียหาย)
- ถ้าอ่านไม่ได้ (PCT ว่าง) → ข้าม ไม่ block การทำงาน

**ทำไมใช้ Python ไม่ใช่ jq?**
`jq` ต้องติดตั้งแยก, Python มาพร้อม macOS/Linux ทุกตัว ลด dependency

### ส่วน 2.5: Configuration Block

```bash
WARN_THRESHOLD=70    # เตือนที่ % นี้ (แนะนำ 60-75)
FORCE_THRESHOLD=80   # บังคับหยุดที่ % นี้ (แนะนำ 75-90)
```

**อธิบาย**:
- ตัวแปรอยู่บนสุดของ script เพื่อให้แก้ง่าย
- 70/80 เป็นค่าเริ่มต้น เพราะ auto-compact ทำงานที่ ~80%
- ถ้าคุณไม่ได้ใช้ /rrr (เช่น ใช้ Claude Code แบบธรรมดา) อาจตั้ง 80/90 ก็ได้

### ส่วน 3: Emergency Stop (80%+)

```bash
FORCE_FLAG="/tmp/rrr-forced-$(date +%Y%m%d-%H)"

if [ "$PCT" -ge "$FORCE_THRESHOLD" ] 2>/dev/null; then
  if [ ! -f "$FORCE_FLAG" ]; then
    touch "$FORCE_FLAG"
    cat >&2 << EOF
🚨🚨🚨 CONTEXT ${PCT}% — EMERGENCY STOP 🚨🚨🚨
...
EOF
  fi
  exit 0
fi
```

**อธิบาย**:

**Flag file**: `rrr-forced-20260410-14`
- ชื่อไฟล์มี วันที่+ชั่วโมง → flag ใหม่ทุกชั่วโมง
- ป้องกันไม่ให้เตือนซ้ำทุก tool use (Claude ใช้ tool บ่อยมาก — 10-50 ครั้งต่อ response)
- ถ้าเตือนทุกครั้ง context จะเต็มเร็วขึ้นอีก (ironic!)

**`cat >&2 << 'EOF'`**:
- `>&2` = เขียนไปที่ stderr (Claude เห็น)
- `<< 'EOF'` = heredoc ที่ไม่ expand variables (single quotes รอบ EOF)
- ข้อความจะแสดงเป็น "system feedback" ให้ Claude

**`2>/dev/null` หลัง `-ge`**: ป้องกัน error ถ้า PCT ไม่ใช่ตัวเลข

### ส่วน 4: Warning (70-79%)

```bash
WARN_FLAG="/tmp/rrr-warn70-$(date +%Y%m%d-%H%M | sed 's/.$//g')"

if [ "$PCT" -ge "$WARN_THRESHOLD" ] 2>/dev/null; then
  if [ ! -f "$WARN_FLAG" ]; then
    touch "$WARN_FLAG"
    cat >&2 << EOF
⚠️ Context at ${PCT}% — Run /rrr + /forward soon!
EOF
  fi
  exit 0
fi
```

**อธิบาย**:

**Flag name trick**: `date +%Y%m%d-%H%M` = `20260410-1423`, `sed 's/.$//g'` ตัดตัวสุดท้ายออก = `20260410-142`

ผลคือ flag เปลี่ยนทุก ~10 นาที:
- 14:20-14:29 → `20260410-142`
- 14:30-14:39 → `20260410-143`

ป้องกันเตือนถี่เกินไป แต่ยังเตือนซ้ำทุก ~10 นาที

**`<< EOF` (ไม่มี quotes)**: heredoc ที่ expand `${PCT}` — แสดงตัวเลข % จริง

### ส่วน 5: ไม่มีอะไร

```bash
exit 0
```

ต่ำกว่า 80% → exit 0 (ปกติ, ไม่เตือน)

## Flow Chart

```
PostToolUse fired
      │
      ▼
statusline JSON มีไหม? ──No──→ exit 0
      │
     Yes
      ▼
อ่าน PCT จาก JSON
      │
      ▼
PCT ≥ 80? ──Yes──→ flag มีไหม? ──Yes──→ exit 0 (เคยเตือนแล้ว)
      │                    │
      │                   No
      │                    ▼
      │              เตือน EMERGENCY (compact กำลังจะมา!) → exit 0
      │
     No
      ▼
PCT ≥ 70? ──Yes──→ flag มีไหม? ──Yes──→ exit 0 (เคยเตือนแล้ว)
      │                    │
      │                   No
      │                    ▼
      │              เตือน WARNING → exit 0
      │
     No
      ▼
exit 0 (ปกติ)
```

## ต่อไป

[Chapter 4: auto-forward-on-stop อธิบายทีละบรรทัด →](04-stop-hook.md)
