# Chapter 6: Customization — ปรับแต่งเอง

## เปลี่ยน Threshold

### ค่าเริ่มต้นและเหตุผล

เปิด `hooks/force-rrr-at-80.sh` — ตัวแปรอยู่บนสุด:

```bash
WARN_THRESHOLD=70    # เตือนที่ % นี้ (แนะนำ 60-75)
FORCE_THRESHOLD=80   # บังคับหยุดที่ % นี้ (แนะนำ 75-90)
```

**ทำไม 70/80?** Claude Code auto-compact ที่ ~80% ถ้ารอถึง 80% แล้วค่อย /rrr → อาจสายเกินไป compact ตัดข้อมูลไปแล้ว 70% ให้พื้นที่ ~20K tokens สำหรับ wrap up

### ปรับตามสไตล์การทำงาน

```bash
# ไม่ได้ใช้ /rrr (Claude Code แบบธรรมดา)
WARN_THRESHOLD=80
FORCE_THRESHOLD=90

# Session สั้น (< 30 min) — context ไม่เต็มง่าย
WARN_THRESHOLD=75
FORCE_THRESHOLD=85

# Session ยาว (> 1 hr) — ต้องเตือนเร็ว
WARN_THRESHOLD=65
FORCE_THRESHOLD=75

# ทำงานกับไฟล์ใหญ่ — context กินเร็วมาก
WARN_THRESHOLD=55
FORCE_THRESHOLD=70
```

## เปลี่ยน Debounce

### ปัญหา: เตือนถี่เกินไป / น้อยเกินไป

**Warning (80%)**:
```bash
# เดิม: เตือนทุก ~10 นาที
WARN_FLAG="/tmp/rrr-warn80-$(date +%Y%m%d-%H%M | sed 's/.$//g')"

# เปลี่ยนเป็น: เตือนทุก ~1 นาที (ไม่ตัดตัวสุดท้าย)
WARN_FLAG="/tmp/rrr-warn80-$(date +%Y%m%d-%H%M)"

# เปลี่ยนเป็น: เตือนทุก ~1 ชั่วโมง
WARN_FLAG="/tmp/rrr-warn80-$(date +%Y%m%d-%H)"
```

**Emergency (90%)**:
```bash
# เดิม: เตือนทุก ~1 ชั่วโมง
FORCE_FLAG="/tmp/rrr-forced-$(date +%Y%m%d-%H)"

# เปลี่ยนเป็น: เตือนทุก ~10 นาที (ดุกว่า)
FORCE_FLAG="/tmp/rrr-forced-$(date +%Y%m%d-%H%M | sed 's/.$//g')"
```

## เปลี่ยนข้อความ

### ภาษาอังกฤษ

```bash
cat >&2 << 'EOF'

🚨 CONTEXT 90%+ — STOP AND SAVE

Your context window is almost full!
Run these commands NOW before data is lost:

1. /rrr        ← Save retrospective
2. /forward    ← Create handoff for next session

EOF
```

### เพิ่ม Sound (macOS)

```bash
# เล่นเสียงเตือน
afplay /System/Library/Sounds/Funk.aiff &

cat >&2 << 'EOF'
🚨 Context 90%+! ...
EOF
```

### เพิ่ม Desktop Notification (Linux)

```bash
notify-send "Claude Code" "⚠️ Context at ${PCT}%! Run /rrr" 2>/dev/null

cat >&2 << EOF
⚠️ Context at ${PCT}%...
EOF
```

### เพิ่ม Desktop Notification (macOS)

```bash
osascript -e 'display notification "Context at '"${PCT}"'%! Run /rrr" with title "Claude Code"' 2>/dev/null
```

## เพิ่ม PostToolUse Hook ใหม่

### ตัวอย่าง: เตือนเมื่อ git push

สร้างไฟล์ `hooks/remind-after-push.sh`:

```bash
#!/bin/bash
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null)

[ "$TOOL_NAME" != "Bash" ] && exit 0

if echo "$COMMAND" | grep -q "git push"; then
  echo '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"✅ Push สำเร็จ! อย่าลืมเปิด PR แล้ว review"}}'
fi
```

เพิ่มใน settings.json:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/remind-after-push.sh"
          }
        ]
      }
    ]
  }
}
```

## เพิ่ม StatusLine Info

### แสดง Cost

```bash
cost=$(echo "$input" | jq -r '.cost.total_cost_usd // 0' 2>/dev/null)
echo "📊 ${pct}% • ${dur} • \$${cost} • ${model}"
```

### แสดง Session ID

```bash
sid=$(echo "$input" | jq -r '.session_id // ""' 2>/dev/null | cut -c1-8)
echo "📊 ${pct}% • ${dur} • ${sid} • ${model}"
```

## Matcher Patterns

`matcher` ใน settings.json เป็น regex:

| Pattern | จับอะไร |
|---------|---------|
| `""` หรือ `".*"` | ทุก tool |
| `"Bash"` | เฉพาะ Bash tool |
| `"Read\|Write\|Edit"` | Read, Write, หรือ Edit |
| `"^(?!Bash).*"` | ทุกอย่างยกเว้น Bash |

## Per-Project Hooks

ต้องการ hook เฉพาะ project? สร้าง `.claude/settings.json` ใน project root:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "./.claude/hooks/project-specific.sh"
          }
        ]
      }
    ]
  }
}
```

hook ของ project จะทำงานร่วมกับ hook ของ global

## ต่อไป

[Chapter 7: Troubleshooting →](07-troubleshooting.md)
