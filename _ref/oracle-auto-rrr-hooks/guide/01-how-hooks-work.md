# Chapter 1: Claude Code Hooks ทำงานยังไง

## Hooks คืออะไร

Claude Code Hooks คือ shell commands ที่ Claude Code จะรันให้อัตโนมัติเมื่อเกิด "event" บางอย่าง เหมือนตัวจับเหตุการณ์ที่คุณติดตั้งไว้ล่วงหน้า

ลองนึกภาพ:
- เมื่อ Claude ใช้ tool → รัน script ของคุณ
- เมื่อ session จบ → รัน script ของคุณ
- เมื่อ status เปลี่ยน → รัน script ของคุณ

คุณเขียน script, Claude Code เป็นคนรัน

## Events ที่มี

| Event | เมื่อไหร่ | ใช้ทำอะไร |
|-------|----------|----------|
| `PreToolUse` | ก่อน Claude ใช้ tool | ตรวจสอบ/block คำสั่งอันตราย |
| `PostToolUse` | หลัง Claude ใช้ tool | เตือน, log, ตรวจสอบผลลัพธ์ |
| `Stop` | session จบ | เตือนให้ /forward, cleanup |
| `UserPromptSubmit` | user พิมพ์ข้อความ | ตรวจสอบ input, แปลงข้อความ |
| `StatusLine` | status เปลี่ยน (ต่อเนื่อง) | แสดงข้อมูล session |

## ตั้งค่าที่ไหน

Hooks ตั้งค่าใน `~/.claude/settings.json` (global) หรือ `.claude/settings.json` (per-project)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/your/script.sh"
          }
        ]
      }
    ]
  }
}
```

### ส่วนประกอบ

1. **Event name** (`PostToolUse`) — เมื่อไหร่จะรัน
2. **matcher** (`".*"`) — regex filter (เช่น `"Bash"` = เฉพาะ Bash tool)
3. **type** (`"command"`) — ประเภท hook (ปัจจุบันมีแค่ command)
4. **command** — path ไปที่ script ที่จะรัน

## Hook รับ/ส่งข้อมูลยังไง

### Input (stdin)
Claude Code ส่ง JSON เข้ามาทาง stdin ของ script

```json
{
  "session_id": "abc123",
  "tool_name": "Bash",
  "tool_input": { "command": "git status" }
}
```

script อ่านด้วย:
```bash
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
```

### Output (stdout)
- **StatusLine**: stdout = ข้อความที่แสดงใน status bar
- **PreToolUse/PostToolUse**: stdout = JSON ที่มี `hookSpecificOutput` (ส่งข้อความกลับให้ Claude)
- **Stop**: stdout ไม่มีผล

### stderr
ข้อความที่เขียนไปที่ stderr จะแสดงใน terminal — Claude เห็นได้ ใช้สำหรับเตือน

```bash
echo "⚠️ อย่าลืม /rrr!" >&2
```

## ลำดับการทำงาน

```
User พิมพ์ → [UserPromptSubmit hook]
              ↓
Claude คิด → เลือก tool
              ↓
           [PreToolUse hook] → block? → ยกเลิก tool
              ↓
           Tool ทำงาน
              ↓
           [PostToolUse hook] → ส่ง feedback กลับ
              ↓
Claude ตอบ → ... (วนซ้ำ)
              ↓
Session จบ → [Stop hook]
```

## สิ่งที่ต้องระวัง

1. **Hook ต้อง exit เร็ว** — ถ้า script ช้า Claude จะรอ (blocking)
2. **exit code 0** = ปกติ, **exit code != 0** = error (Claude อาจ skip)
3. **อย่า print เยอะเกินไป** — output เข้า context window
4. **ใช้ flag files สำหรับ debounce** — ป้องกันเตือนซ้ำทุก tool use

## ทดสอบ Hook

ทดสอบ script โดยไม่ต้องเปิด Claude Code:

```bash
# ทดสอบ statusline
echo '{"context_window":{"used_percentage":75}}' | bash hooks/statusline.sh

# ทดสอบ force-rrr
echo '{"context_window":{"used_percentage":85}}' > /tmp/statusline-raw.json
bash hooks/force-rrr-at-80.sh

# ทดสอบ stop hook
echo '{}' | bash hooks/auto-forward-on-stop.sh
```

## ต่อไป

[Chapter 2: Context % คืออะไร →](02-context-percentage.md)
