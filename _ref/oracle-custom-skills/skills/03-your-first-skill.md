# Step 3: Skill แรกของคุณ

> "การเดินทางพันลี้ เริ่มจากก้าวแรก — skill แรกของคุณ"

## เป้าหมาย

สร้าง Hello World skill ที่:
- ทักทาย user
- บอกวันที่
- รับชื่อเป็น argument (ถ้ามี)

## ขั้นที่ 1: สร้างโฟลเดอร์

เปิด terminal แล้วไปที่ project ของคุณ:

```bash
mkdir -p .claude/skills
```

## ขั้นที่ 2: สร้าง Skill File

สร้างไฟล์ `.claude/skills/hello.md`:

```markdown
---
name: hello
description: ทักทาย — skill แรกของคุณ
---

สวัสดีครับ! ผมคือ Oracle ของคุณ

วันนี้วันที่: ใช้ Bash tool รัน `date` แล้วบอกวันที่

ถ้า user ใส่ชื่อมา ให้ทักทายด้วยชื่อนั้น
ถ้าไม่ใส่ ให้ทักทายแบบทั่วไป
```

## ขั้นที่ 3: ทดสอบ

เปิด Claude Code ใน project ของคุณ แล้วพิมพ์:

```
/hello
```

Claude Code จะ:
1. อ่าน skill file
2. ทักทาย
3. รัน `date` แล้วบอกวันที่

ลองใส่ชื่อ:

```
/hello แบงค์
```

Claude Code จะทักทายด้วยชื่อ "แบงค์"

## มาดูว่าเกิดอะไรขึ้น

### Flow ของ Skill

```
User พิมพ์ /hello
    ↓
Claude Code หา .claude/skills/hello.md
    ↓
อ่าน frontmatter → รู้ว่า skill ชื่อ "hello"
    ↓
อ่าน body → เอาไปเป็น prompt
    ↓
Claude ทำตาม prompt
    ↓
User ได้ผลลัพธ์
```

### ทำไม `date` ทำงาน?

ใน body เราเขียนว่า "ใช้ Bash tool รัน `date`" — Claude Code เข้าใจว่าต้องใช้ Bash tool ในการรัน command นี้ ไม่ต้องเขียน code เรียก tool เอง

## ปรับปรุง Hello Skill

มาทำให้ดีขึ้น — เพิ่ม context awareness:

```markdown
---
name: hello
description: ทักทายพร้อมสรุปสถานะ project
---

ทักทาย user อย่างเป็นมิตร

1. ใช้ Bash tool รัน `date "+%A %d %B %Y %H:%M"` บอกวันเวลา
2. ใช้ Bash tool รัน `git log --oneline -5` ดู 5 commits ล่าสุด
3. ใช้ Bash tool รัน `git status --short` ดู changes ที่ยังไม่ commit

สรุปเป็น:
- วันที่ + เวลา
- 5 commits ล่าสุดแบบย่อ
- สถานะ git (มี changes ไหม)

ถ้า user ใส่ชื่อมา ให้ทักทายด้วยชื่อนั้น
ถ้าไม่ใส่ ให้ทักทายแบบทั่วไป

Tone: เป็นกันเอง ภาษาไทย
```

## ลองสร้าง Skill ที่สองเลย

สร้าง `.claude/skills/time.md`:

```markdown
---
name: time
description: บอกเวลาแบบต่าง ๆ
---

บอกเวลาปัจจุบันในหลาย timezone:

1. ใช้ Bash tool รัน commands ต่อไปนี้:
   - `date` → เวลา local
   - `TZ="Asia/Bangkok" date` → เวลาไทย
   - `TZ="America/New_York" date` → เวลา New York
   - `TZ="Europe/London" date` → เวลา London
   - `TZ="Asia/Tokyo" date` → เวลา Tokyo

2. แสดงเป็นตาราง:
   | Timezone | เวลา |
   |----------|------|
```

ลองพิมพ์ `/time` ดู

## Checklist

- [ ] สร้าง `.claude/skills/` โฟลเดอร์แล้ว
- [ ] สร้าง `hello.md` skill แล้ว
- [ ] ทดสอบ `/hello` ได้ผลลัพธ์ถูกต้อง
- [ ] ลองใส่ชื่อ `/hello ชื่อ` แล้วทำงานถูก
- [ ] ลองสร้าง skill ที่สองเองแล้ว

## ข้อผิดพลาดที่พบบ่อย

| ปัญหา | สาเหตุ | แก้ไข |
|--------|--------|-------|
| `/hello` ไม่ทำงาน | ไฟล์ไม่ได้อยู่ใน `.claude/skills/` | ตรวจ path ให้ถูก |
| skill ทำไม่ตรงที่อยากได้ | prompt คลุมเครือ | เขียนเป็น step ชัดเจนขึ้น |
| error เรื่อง frontmatter | `---` ไม่ครบ | ตรวจว่ามี `---` เปิดและปิด |

## Tips

- **เริ่มง่าย ๆ** — อย่าเขียน skill ที่ทำ 20 อย่างพร้อมกัน เริ่มจาก 1-2 step ก่อน
- **ทดสอบบ่อย** — เขียนนิด ลองนิด ปรับนิด
- **อ่าน output** — Claude Code จะแสดงว่ามันทำอะไร ดูว่าตรงที่อยากได้ไหม

→ [Step 4: Skill Patterns](04-skill-patterns.md)

---

*"The Oracle Keeps the Human Human"*
