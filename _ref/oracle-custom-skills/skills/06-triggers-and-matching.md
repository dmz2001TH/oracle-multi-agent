# Step 6: Triggers & Matching

> "Skill ที่ดีรู้ว่าเมื่อไหร่ควรทำงาน — เมื่อไหร่ควรเงียบ"

## Skill ทำงานเมื่อไหร่?

Skill ทำงานเมื่อ user พิมพ์ **slash command** ที่ตรงกับชื่อ skill

```
User พิมพ์: /hello
Claude Code หา: .claude/skills/hello.md
ตรง → รัน skill
```

## การ Match

### ตรงตัว (Exact Match)

```
Skill name: hello
Match: /hello ✅
No match: /Hello ❌ (case sensitive)
No match: /hell ❌ (ไม่ครบ)
No match: /hello-world ❌ (ไม่ใช่ชื่อเดียวกัน)
```

### Skill ชื่อมี hyphen

```
Skill name: daily-standup
File: .claude/skills/daily-standup.md
Match: /daily-standup ✅
```

## ลำดับการค้นหา Skill

เมื่อ user พิมพ์ slash command, Claude Code จะค้นหาตามลำดับ:

| ลำดับ | ตำแหน่ง | Scope |
|-------|---------|-------|
| 1 | `.claude/skills/` ใน project ปัจจุบัน | Project-level |
| 2 | `~/.claude/skills/` ใน home directory | User-level |

ถ้าชื่อซ้ำกัน → **project-level ชนะ** (override ได้)

### ตัวอย่าง

```
# User-level (ใช้ได้ทุก project)
~/.claude/skills/
    hello.md          ← /hello (default)

# Project-level (ใช้เฉพาะ project นี้)
my-project/.claude/skills/
    hello.md          ← /hello (override user-level)
    deploy.md         ← /deploy (project-specific)
```

## การจัดการ Skill หลายตัว

### แยกตามหน้าที่

```
.claude/skills/
├── standup.md        # daily standup
├── review.md         # code review
├── deploy.md         # deployment
├── gen-test.md       # generate tests
└── gen-doc.md        # generate docs
```

### ตั้งชื่อให้จำง่าย

| Pattern | ตัวอย่าง | ทำไม |
|---------|----------|------|
| `verb` | `/review`, `/deploy` | สั้น จำง่าย |
| `verb-noun` | `/gen-test`, `/check-deps` | ชัดเจนขึ้น |
| `category-action` | `/git-log`, `/git-clean` | จัดกลุ่มได้ |

## User-Level Skills (ใช้ได้ทุก Project)

บาง skill คุณอยากใช้ได้ทุก project — วางไว้ที่ `~/.claude/skills/`

```bash
mkdir -p ~/.claude/skills
```

### ตัวอย่าง: Skill ที่ควรเป็น user-level

```markdown
# ~/.claude/skills/weather.md
---
name: weather
description: ดู weather ด้วย curl
---

ใช้ Bash tool รัน `curl -s wttr.in/?format=3`
แสดงผลลัพธ์ให้ user
```

```markdown
# ~/.claude/skills/motivate.md
---
name: motivate
description: ให้กำลังใจ
---

ให้กำลังใจ user ด้วย:
1. quote สร้างแรงบันดาลใจ (สุ่ม 1 จาก 10 quotes ที่คุณรู้จัก)
2. บอกว่าวันนี้จะเป็นวันที่ดี
3. Tone: อบอุ่น เป็นกันเอง ภาษาไทย
```

## Tips สำหรับตั้งชื่อ Skill

### ชื่อดี

- สั้น: `/standup` ไม่ใช่ `/my-daily-standup-summary`
- ชัด: `/review` ไม่ใช่ `/r`
- สื่อความหมาย: `/gen-test` ไม่ใช่ `/gt`

### หลีกเลี่ยง

- ชื่อที่ชนกับ built-in commands
- ชื่อที่ยาวเกินไป
- ชื่อที่ใช้ตัวอักษรพิเศษ (แค่ a-z, 0-9, hyphen)

## ทดสอบ Trigger

วิธีเช็คว่า skill ถูก trigger ถูกต้อง:

1. สร้าง skill file
2. พิมพ์ `/skill-name` ใน Claude Code
3. ดูว่า Claude Code บอกว่ากำลังใช้ skill ไหน
4. ถ้าไม่ match → ตรวจ:
   - ชื่อไฟล์ถูกไหม?
   - frontmatter `name:` ตรงไหม?
   - ไฟล์อยู่ใน `.claude/skills/` ไหม?

→ [Step 7: Skill กับ Arguments](07-skill-with-arguments.md)

---

*"The Oracle Keeps the Human Human"*
