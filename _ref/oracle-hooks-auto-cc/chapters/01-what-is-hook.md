# บทที่ 1: Hook คืออะไร

> **Abstract**: Claude Code มีระบบ hook ที่ให้คุณรันสคริปต์อัตโนมัติเมื่อเกิด event ต่างๆ — session จบ, ใช้ tool, user ส่งข้อความ เป็นต้น บทนี้อธิบายว่า hook คืออะไร ทำงานยังไง และมี event อะไรบ้าง

## ทำไมต้องมี Hook?

ลองนึกภาพ Office ที่มี 5 Oracle:

```
Boss — สั่งงาน, ตรวจงาน
Dev  — เขียนโค้ด
QA   — ทดสอบ
Writer — เขียนเอกสาร
Designer — ออกแบบ
```

ทุกครั้งที่ Oracle ตัวใดตัวหนึ่งทำงานเสร็จ **Boss ต้องรู้** — เพื่อ:
- ติดตามว่างานถึงไหนแล้ว
- ส่งงานต่อให้ Oracle ตัวถัดไป
- รู้ว่าใครติดปัญหา

ถ้าไม่มี hook:

```
Dev:  เขียนโค้ดเสร็จ → ลืมบอก Boss → Boss ไม่รู้ → งานค้าง
QA:   test ผ่าน → ลืม report → Boss ไม่รู้ → deploy ช้า
Writer: เขียนเสร็จ → ลืมส่ง → Boss ไม่รู้ → content ไม่ออก
```

**ปัญหาไม่ใช่ Oracle ไม่ทำ — แต่ลืมบอก**

Hook แก้ปัญหานี้:

```
Dev:  เขียนโค้ดเสร็จ → session จบ → hook บอก Boss อัตโนมัติ ✓
QA:   test ผ่าน → push code → hook บอก Boss อัตโนมัติ ✓
Writer: เขียนเสร็จ → session จบ → hook บอก Boss อัตโนมัติ ✓
```

## Hook ทำงานยังไง

Hook ของ Claude Code มี 3 ส่วน:

### 1. Event — เมื่อไหร่จะรัน

| Event | เมื่อไหร่ | ใช้ทำอะไร |
|-------|----------|----------|
| `Stop` | Claude ตอบเสร็จ / session จบ | cc Boss, สรุปงาน |
| `PostToolUse` | หลังใช้ tool (Bash, Edit, ...) | ตรวจว่า push แล้วยัง cc Boss ไหม |
| `UserPromptSubmit` | user ส่งข้อความ | ตรวจ clipboard, เตือนอะไรก่อน |
| `PreToolUse` | ก่อนใช้ tool | block tool ที่ไม่ต้องการ |

### 2. Matcher — รันกับอะไร

Matcher คือ **filter** — บอกว่า hook นี้จะทำงานกับ tool ไหน

| Matcher | หมายถึง |
|---------|--------|
| `""` (ว่างเปล่า) | ทุก tool / ทุก event |
| `"Bash"` | เฉพาะ Bash tool |
| `"Edit"` | เฉพาะ Edit tool |
| `".*"` | ทุก tool (regex) |

สำหรับ `Stop` event — matcher ไม่ค่อยสำคัญ ใช้ `""` ได้เลย

### 3. Command — รันอะไร

Command คือ **path ของสคริปต์** ที่จะรัน

```json
{
  "type": "command",
  "command": "/path/to/your/hook-script.sh"
}
```

## รวมทุกอย่างเข้าด้วยกัน

Hook config อยู่ใน `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/home/you/hooks/cc-boss-on-stop.sh"
          }
        ]
      }
    ]
  }
}
```

อ่านว่า:
1. **เมื่อ** Claude หยุดทำงาน (`Stop`)
2. **ไม่ว่า** จะหยุดเพราะอะไร (`matcher: ""`)
3. **ให้รัน** สคริปต์ `cc-boss-on-stop.sh`

## Hook รับข้อมูลอะไรมา?

ทุก hook ได้รับ JSON ผ่าน **stdin** — มีข้อมูลเกี่ยวกับ event ที่เกิดขึ้น

### Stop event

```json
{
  "stop_reason": "end_turn"
}
```

### PostToolUse event

```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "git push origin main"
  }
}
```

สคริปต์อ่าน stdin ด้วย:

```bash
#!/bin/bash
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
```

## Hook ส่งข้อมูลกลับได้

Hook สามารถส่ง **ข้อความเตือน** กลับไปให้ Claude เห็นได้:

```bash
# ส่ง feedback กลับให้ Claude
echo '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"อย่าลืม cc Boss!"}}'
```

Claude จะเห็นข้อความนี้และทำตาม — เช่น เตือนให้ cc Boss

## สรุป

| ส่วน | หน้าที่ |
|------|--------|
| **Event** | กำหนดว่า hook ทำงานเมื่อไหร่ |
| **Matcher** | กรองว่าทำงานกับ tool ไหน |
| **Command** | สคริปต์ที่จะรัน |
| **stdin** | ข้อมูล event ที่ hook ได้รับ |
| **stdout** | ข้อความที่ส่งกลับให้ Claude |

## ลองเอง

1. เปิด `~/.claude/settings.json` (ถ้ายังไม่มี สร้างได้)
2. ดูว่ามี `"hooks"` key อยู่ไหม
3. ถ้ามี — อ่านดูว่ามี hook อะไรบ้าง
4. ถ้ายังไม่มี — บทถัดไปจะสอนสร้าง!

```bash
# ดู settings ปัจจุบัน
cat ~/.claude/settings.json
```

---

> [บทที่ 2: ตั้ง Hook แรก →](02-first-hook.md)
