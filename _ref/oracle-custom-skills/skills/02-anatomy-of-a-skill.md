# Step 2: โครงสร้างของ Skill

> "รู้โครงสร้าง = เขียนได้ทุกอย่าง"

## Skill File = Frontmatter + Body

ทุก skill file มี 2 ส่วน:

```markdown
---
name: skill-name
description: อธิบายสั้น ๆ ว่า skill ทำอะไร
---

เนื้อหา prompt ที่จะสั่งให้ Claude Code ทำ
```

### ส่วนที่ 1: Frontmatter (ส่วนหัว)

Frontmatter คือส่วนที่อยู่ระหว่าง `---` บนสุดของไฟล์ เขียนในรูปแบบ YAML

```yaml
---
name: standup
description: สรุปงานวันนี้จาก git log
---
```

| Field | ต้องมี? | อธิบาย |
|-------|---------|--------|
| `name` | ต้องมี | ชื่อ skill — ใช้เป็น slash command (`/standup`) |
| `description` | ควรมี | อธิบายสั้น ๆ — แสดงใน skill list |

### กฎตั้งชื่อ

| ดี | ไม่ดี | เหตุผล |
|----|-------|--------|
| `daily-standup` | `Daily Standup` | ใช้ kebab-case, ตัวเล็ก |
| `review` | `my-super-awesome-review` | สั้นกระชับ |
| `gen-test` | `generate_test_cases` | ไม่ใช้ underscore |

### ส่วนที่ 2: Body (เนื้อหา)

Body คือ **prompt** ที่คุณเขียนเป็นภาษาคน บอก Claude Code ว่าต้องทำอะไร

```markdown
---
name: standup
description: สรุปงานวันนี้
---

ช่วยสรุปงานของวันนี้:

1. ใช้ Bash tool รัน `git log --since="yesterday" --oneline`
2. จัดกลุ่ม commit ตามประเภท (feat, fix, docs, etc.)
3. สรุปเป็น bullet points ภาษาไทย
4. ถ้าไม่มี commit → บอกว่า "วันนี้ยังไม่มี commit"
```

เมื่อ user พิมพ์ `/standup` → Claude Code จะอ่าน body นี้แล้วทำตามที่เขียน

## ตำแหน่งไฟล์

Skill files ต้องอยู่ใน `.claude/skills/` ของ project

```
your-project/
├── .claude/
│   └── skills/
│       ├── standup.md        ← /standup
│       ├── review.md         ← /review
│       └── gen-test.md       ← /gen-test
```

### ตั้งชื่อไฟล์

- ชื่อไฟล์ = ชื่อ skill (ไม่รวม `.md`)
- แนะนำให้ชื่อไฟล์ตรงกับ `name` ใน frontmatter
- ใช้ kebab-case: `daily-standup.md` ไม่ใช่ `dailyStandup.md`

## ตัวอย่างเต็ม

### Skill ง่าย — ทักทาย

```markdown
---
name: hello
description: ทักทาย
---

สวัสดีครับ! ผมพร้อมช่วยแล้ว
บอกวันที่และเวลาปัจจุบันด้วย (ใช้ Bash tool รัน `date`)
```

### Skill กลาง — สรุป TODO

```markdown
---
name: todos
description: ค้นหาและสรุป TODO ใน codebase
---

ค้นหา TODO ทั้งหมดใน codebase:

1. ใช้ Grep tool ค้นหา pattern "TODO" ในทุกไฟล์
2. จัดกลุ่มตามไฟล์
3. แสดงเป็นตาราง:
   | ไฟล์ | บรรทัด | เนื้อหา TODO |
4. สรุปว่ามีทั้งหมดกี่ TODO
5. แนะนำว่า TODO ไหนควรทำก่อน (จาก context)
```

### Skill ซับซ้อน — Review PR

```markdown
---
name: review
description: review code changes อย่างละเอียด
---

Review code ที่เปลี่ยนแปลง:

1. ใช้ Bash tool รัน `git diff --staged` ดู staged changes
2. ถ้าไม่มี staged → รัน `git diff` ดู unstaged changes
3. วิเคราะห์แต่ละไฟล์:
   - มี bug potential ไหม?
   - naming convention ถูกต้องไหม?
   - มี edge case ที่ไม่ได้ handle ไหม?
   - performance concern?
4. ให้คะแนน 1-5:
   - 5 = พร้อม merge
   - 3 = มี suggestion เล็กน้อย
   - 1 = ต้องแก้ก่อน
5. สรุปเป็นภาษาไทย
```

## Body Tips

### ใช้ numbered steps
Claude Code ทำตาม step ได้ดีเมื่อเขียนเป็นลำดับชัดเจน

### ระบุ tool ที่ต้องใช้
บอกชัดว่า "ใช้ Bash tool", "ใช้ Grep tool" → ผลลัพธ์แม่นยำขึ้น

### มี fallback
"ถ้าไม่มี X → ทำ Y แทน" ป้องกัน skill พังเมื่อเจอสถานการณ์ไม่คาดคิด

### กำหนด output format
"สรุปเป็นตาราง", "แสดงเป็น bullet points" → ได้ output ที่ consistent

## ข้อผิดพลาดที่พบบ่อย

| ผิด | ถูก | เหตุผล |
|-----|-----|--------|
| ไม่มี `---` ปิด frontmatter | มี `---` ครบ เปิด-ปิด | frontmatter ต้องครบคู่ |
| เขียน body คลุมเครือ | เขียนเป็น step ชัดเจน | Claude Code ทำตาม step ได้ดีกว่า |
| ไม่ระบุ fallback | มี "ถ้า...ไม่มี → ทำ..." | ป้องกัน error |
| ชื่อ skill มี space | ใช้ kebab-case | space ใน command ใช้ไม่ได้ |

## ลองเอง

สร้างไฟล์ `.claude/skills/test.md` ใน project ของคุณ:

```markdown
---
name: test
description: ทดสอบ skill
---

บอกว่า "Skill ทำงานแล้ว!"
แล้วแสดงชื่อ project จาก package.json (ถ้ามี)
```

แล้วลองพิมพ์ `/test` ใน Claude Code

→ [Step 3: Skill แรกของคุณ](03-your-first-skill.md)

---

*"The Oracle Keeps the Human Human"*
