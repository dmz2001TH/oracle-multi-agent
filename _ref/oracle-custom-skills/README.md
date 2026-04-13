# Oracle Custom Skills — สร้าง Skill ของตัวเอง

> "ทุกคนสอน Oracle ได้ — ผ่าน Skills ที่เขียนเอง"

## Custom Skill คืออะไร?

Custom Skill คือ **ไฟล์ markdown** ที่คุณเขียนเอง วางไว้ใน `.claude/skills/` แล้ว Claude Code จะเปลี่ยนมันเป็น **slash command** ที่ใช้ได้ทันที

เขียน skill = สอน Oracle ว่า "เวลาพิมพ์ `/ชื่อนี้` ให้ทำอะไร"

ไม่ต้องเขียน code, ไม่ต้อง compile, ไม่ต้อง deploy — แค่เขียน markdown แล้วใช้ได้เลย

## คู่มือนี้สำหรับใคร?

| คุณคือ | คุณจะได้ |
|--------|----------|
| เพิ่งเริ่มใช้ Claude Code | เข้าใจว่า skill คืออะไร + สร้าง skill แรกได้ |
| ใช้ Claude Code อยู่แล้ว | สร้าง skill ที่ซับซ้อนขึ้น + แชร์ให้คนอื่นใช้ |
| มี Oracle Office แล้ว | เพิ่ม skill ให้ Oracle ของคุณทำงานได้หลากหลาย |

## เรียนทีละ Step

| Step | หัวข้อ | เวลา | เนื้อหา |
|------|--------|------|---------|
| 01 | [Skill คืออะไร?](skills/01-what-is-a-skill.md) | 15 นาที | แนวคิด, ทำไมต้องมี skill |
| 02 | [โครงสร้างของ Skill](skills/02-anatomy-of-a-skill.md) | 20 นาที | frontmatter, body, metadata |
| 03 | [Skill แรกของคุณ](skills/03-your-first-skill.md) | 20 นาที | Hello World — ลงมือทำ |
| 04 | [Skill Patterns](skills/04-skill-patterns.md) | 25 นาที | search, generate, transform |
| 05 | [ใช้ Tools ใน Skill](skills/05-using-tools-in-skills.md) | 25 นาที | Read, Write, Bash, Grep |
| 06 | [Triggers & Matching](skills/06-triggers-and-matching.md) | 20 นาที | skill ทำงานเมื่อไหร่ |
| 07 | [Skill กับ Arguments](skills/07-skill-with-arguments.md) | 25 นาที | รับ input จาก user |
| 08 | [ทดสอบ Skill](skills/08-testing-your-skill.md) | 20 นาที | debug, test, iterate |
| 09 | [แชร์ Skill](skills/09-sharing-skills.md) | 15 นาที | publish ด้วย oracle-skills-cli |
| 10 | [ตัวอย่างจริง](skills/10-real-world-examples.md) | 30 นาที | skills จาก Oracle ecosystem |

## ตัวอย่าง

| ตัวอย่าง | ระดับ | รายละเอียด |
|----------|-------|-----------|
| [Hello World](examples/hello-world.md) | เริ่มต้น | skill ง่ายที่สุด — ทักทาย |
| [Daily Standup](examples/daily-standup.md) | กลาง | สรุปงานวันนี้จาก git log |
| [Code Reviewer](examples/code-reviewer.md) | สูง | review code อัตโนมัติ |

## ปรัชญา

> "Oracle สร้าง Oracle — Recursion is the highest form of creation."

ทุก skill ที่คุณเขียน คือการ **สอน Oracle** ให้ทำสิ่งใหม่ได้
เมื่อคุณแชร์ skill → คนอื่นเอาไปใช้ → ปรับปรุง → แชร์ต่อ
นี่คือ recursion — Oracle สร้าง Oracle ไม่มีที่สิ้นสุด

Skill คือหน่วยที่เล็กที่สุดของการสอน Oracle
แต่เมื่อ skill หลายตัวรวมกัน → เกิดเป็น Oracle ที่มีความสามารถไม่จำกัด

## เริ่มเลย

→ [Step 1: Skill คืออะไร?](skills/01-what-is-a-skill.md)

## มีคำถาม?

เปิด Discussion ได้เลย — ทีมพร้อมช่วย

---

*"The Oracle Keeps the Human Human"*
