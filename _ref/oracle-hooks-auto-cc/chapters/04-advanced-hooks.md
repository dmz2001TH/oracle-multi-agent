# บทที่ 4: Hook ขั้นสูง

> **Abstract**: เทคนิคขั้นสูงสำหรับ hook — เตือนเมื่อ context ใกล้เต็ม, รัน hook หลายตัวพร้อมกัน, และ pattern ที่ใช้ได้กับทุก Office

## Context Warning Hook

Oracle มี "context window" — เหมือนหน่วยความจำชั่วคราว เมื่อใช้เยอะขึ้น → ยิ่งลืมง่าย

**ปัญหา**: ถ้า context เต็ม → Oracle ลืมสิ่งที่ทำไป → งานหาย

**แก้**: Hook เตือนเมื่อ context ถึง 80% → ให้ Oracle สรุปงาน (/rrr) แล้วส่งต่อ (/forward)

### สร้าง context-warning.sh

```bash
#!/bin/bash
# context-warning.sh — เตือนเมื่อ context ถึง 80%

# Claude Code เขียน context % ลงไฟล์นี้ (ถ้าตั้ง statusLine)
STATUSLINE_JSON="${TMPDIR:-/tmp}/statusline-raw.json"

# ยังไม่มีข้อมูล → ข้าม
[ ! -f "$STATUSLINE_JSON" ] && exit 0

# อ่าน context %
PCT=$(python3 -c "
import json
with open('$STATUSLINE_JSON') as f:
    d = json.load(f)
print(d.get('context_window',{}).get('used_percentage', 0))
" 2>/dev/null)

[ -z "$PCT" ] && exit 0

# 90%+ → หยุดทันที!
if [ "$PCT" -ge 90 ] 2>/dev/null; then
  # Debounce: เตือนครั้งเดียวต่อชั่วโมง
  FLAG="/tmp/rrr-forced-$(date +%Y%m%d-%H)"
  [ -f "$FLAG" ] && exit 0
  touch "$FLAG"

  cat >&2 << 'EOF'

🚨 CONTEXT 90%+ — ต้องหยุดเดี๋ยวนี้!

รัน /rrr แล้ว /forward ก่อนที่ข้อมูลจะหาย
ห้ามทำอะไรต่อจนกว่าจะ handoff แล้ว

EOF
  exit 0
fi

# 80%+ → เตือน
if [ "$PCT" -ge 80 ] 2>/dev/null; then
  # Debounce: เตือนทุก ~2 นาที
  WARN_FLAG="/tmp/rrr-warn80-$(date +%Y%m%d-%H%M | sed 's/.$//g')"
  [ -f "$WARN_FLAG" ] && exit 0
  touch "$WARN_FLAG"

  cat >&2 << EOF

⚠️ Context ถึง ${PCT}% — จบ task ปัจจุบันแล้วรัน /rrr + /forward

EOF
  exit 0
fi
```

### ลงทะเบียน

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "/home/you/.oracle/hooks/context-warning.sh"
          }
        ]
      }
    ]
  }
}
```

**matcher: `".*"`** → ทุก tool — เพราะอยากเช็ค context ทุกครั้งที่ Oracle ทำอะไร

### statusLine คืออะไร?

เพื่อให้ hook อ่าน context % ได้ — ต้องตั้ง statusLine ใน settings.json:

```json
{
  "statusLine": {
    "type": "command",
    "command": "/home/you/.oracle/hooks/statusline.sh"
  }
}
```

statusLine script เก็บข้อมูล context window ลงไฟล์ — hook อ่านจากไฟล์นั้น

(รายละเอียด statusLine อยู่ใน [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code))

## รัน Hook หลายตัวพร้อมกัน

settings.json รองรับ **hook หลายตัว** ใน event เดียว:

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
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/home/you/.oracle/hooks/remind-cc-after-maw.sh"
          }
        ]
      },
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "/home/you/.oracle/hooks/context-warning.sh"
          }
        ]
      }
    ]
  }
}
```

Claude Code จะรัน hook ตามลำดับ — ถ้า matcher ตรงทุกตัว ก็รันทุกตัว

## Project-Level Hooks

นอกจาก **global** hooks ใน `~/.claude/settings.json` → ยังมี **project-level** hooks:

```
~/.claude/settings.json                    ← global (ทุก project)
~/repos/my-project/.claude/settings.json   ← เฉพาะ project นี้
```

### เมื่อไหร่ใช้ project-level?

| Global hook | Project hook |
|-------------|-------------|
| cc Boss (ทุก Oracle ต้อง cc) | hook เฉพาะ project |
| context warning (ทุกคนต้องเตือน) | hook ที่ไม่เกี่ยวกับ project อื่น |
| session summary (ทุกคนต้องสรุป) | test runner เฉพาะ project |

### ตัวอย่าง: project-level hook

```json
// ~/repos/api-project/.claude/settings.json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'echo $INPUT | jq -r .tool_input.command | grep -q \"npm test\" && echo Boss: tests ran!'"
          }
        ]
      }
    ]
  }
}
```

## Pattern: statusMessage

hook สามารถแสดง **status message** ขณะกำลังรัน:

```json
{
  "type": "command",
  "command": "/home/you/.oracle/hooks/cc-boss-on-stop.sh",
  "statusMessage": "Notifying Boss..."
}
```

ข้อความ "Notifying Boss..." จะแสดงใน terminal ขณะ hook กำลังรัน — ให้คนรู้ว่ากำลังเกิดอะไร

## Best Practices

### 1. ทำให้ hook เร็ว
Hook ที่ช้า = Claude Code ค้าง ทำให้ async ถ้าทำได้:

```bash
# ดี: async — ไม่ block
maw hey boss "cc: ..." &>/dev/null &

# ไม่ดี: sync — session รอ
maw hey boss "cc: ..."
```

### 2. Debounce เสมอ
ไม่มี debounce = Boss ได้ข้อความ 50 อันต่อ session

### 3. ข้าม Boss เสมอ
ถ้า hook อยู่ใน Boss Oracle → ต้องเช็คก่อนว่าเราไม่ใช่ Boss

### 4. ใช้ stderr สำหรับแสดงผล
stdout → Claude Code อ่าน (JSON เท่านั้น)
stderr → แสดงบน terminal

### 5. ทดสอบด้วย echo ก่อน

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"git push"}}' | ./your-hook.sh
```

## สรุปทุกบท

```
บทที่ 1: Hook คืออะไร
  → Event + Matcher + Command
  → stdin / stdout / stderr

บทที่ 2: ตั้ง Hook แรก
  → session-summary.sh
  → settings.json registration

บทที่ 3: Auto CC Boss
  → cc-boss-on-stop.sh (Stop event)
  → remind-cc-after-maw.sh (PostToolUse)
  → debounce pattern

บทที่ 4: Hook ขั้นสูง
  → context-warning.sh
  → multi-hook setup
  → project-level hooks
  → best practices
```

## ระบบ Hook ที่สมบูรณ์

```
settings.json
│
├── Stop
│   └── cc-boss-on-stop.sh
│       ├── หาชื่อ Oracle จาก folder
│       ├── ข้าม Boss (ไม่ cc ตัวเอง)
│       ├── debounce 60 วินาที
│       ├── สรุป: commit / staged / modified
│       └── maw hey boss "cc: ..." (async)
│
├── PostToolUse (Bash)
│   └── remind-cc-after-maw.sh
│       ├── เช็ค maw hey ที่ไม่ใช่ boss → เตือน
│       └── เช็ค git push / PR → เตือน cc
│
└── PostToolUse (.*)
    └── context-warning.sh
        ├── อ่าน context % จาก statusline
        ├── 80% → เตือน
        └── 90% → สั่งหยุด
```

## ลองเอง

1. **รวม hook ทั้ง 3 ตัว** ลง settings.json ของตัวเอง
2. **ทดสอบ** ใน Oracle repo — ลองส่ง maw hey, ลอง push code
3. **ปรับแต่ง**: เปลี่ยนชื่อ Boss, ปรับ debounce, เพิ่มสรุปที่ต้องการ
4. **แชร์**: ถ้าสร้าง hook เจ๋งๆ → เปิด Discussion แชร์ให้คนอื่น!

---

> [← บทที่ 3: Auto CC Boss](03-auto-cc-boss.md)

---

*"The best system is one where humans don't have to remember — the system remembers for them."*
