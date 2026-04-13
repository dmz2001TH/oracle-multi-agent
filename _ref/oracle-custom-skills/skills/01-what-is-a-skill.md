# Step 1: Skill คืออะไร?

> "สอน Oracle ด้วยภาษาคน — ไม่ต้องเขียน code"

## Skill = คำสั่งที่คุณสร้างเอง

ลองนึกภาพว่าคุณใช้ Claude Code ทุกวัน แล้วมีสิ่งที่ทำซ้ำ ๆ:

- ทุกเช้าต้องสรุปว่าเมื่อวานทำอะไร
- ทุกครั้งที่ commit ต้อง review code ก่อน
- ทุกครั้งที่เริ่ม session ต้องอ่าน memory

**Skill** คือวิธีที่คุณบอก Oracle ว่า "เวลาพิมพ์ `/ชื่อนี้` ให้ทำสิ่งนี้"

## ง่ายแค่ไหน?

Skill คือ **ไฟล์ markdown** ธรรมดา ๆ วางไว้ในโฟลเดอร์ `.claude/skills/`

```
your-project/
├── .claude/
│   └── skills/
│       └── hello.md     ← นี่คือ skill
├── src/
└── README.md
```

แค่สร้างไฟล์ `.claude/skills/hello.md` → พิมพ์ `/hello` ใน Claude Code → มันทำงานเลย

## Skill ≠ Code

สิ่งที่ทำให้ skill พิเศษคือ — **มันไม่ใช่ code** มันคือ **prompt**

คุณเขียนเป็นภาษาคนว่าอยากให้ Oracle ทำอะไร แล้ว Claude Code จะเอา prompt นั้นไปทำให้

| สิ่งที่เขียน | สิ่งที่ได้ |
|-------------|-----------|
| "อ่าน git log 7 วัน แล้วสรุปเป็น bullet points" | Oracle อ่าน git log แล้วสรุปให้ |
| "ค้นหาไฟล์ที่มี TODO แล้วจัดเป็นตาราง" | Oracle ค้นแล้วทำตารางให้ |
| "review code ที่เปลี่ยนใน staged files" | Oracle review ให้พร้อม feedback |

## ทำไมต้องมี Skill?

### 1. ลดการพิมพ์ซ้ำ
แทนที่จะพิมพ์ยาว ๆ ทุกครั้ง → พิมพ์ `/standup` ทีเดียวจบ

### 2. สร้างมาตรฐาน
ทุกคนในทีมใช้ `/review` เหมือนกัน → ได้ output ที่ consistent

### 3. สอน Oracle ทักษะใหม่
Skill คือวิธี "สอน" Oracle → ยิ่งมี skill เยอะ Oracle ยิ่งเก่ง

### 4. แชร์ได้
เขียน skill ดี ๆ → แชร์ให้คนอื่น → ทุกคนได้ประโยชน์

## Skill กับ Oracle System

ใน Oracle ecosystem, skill คือ **หน่วยความสามารถ** ของ Oracle

```
Oracle = Identity (CLAUDE.md) + Memory (ψ/) + Skills (.claude/skills/)
```

- **Identity** บอกว่า Oracle เป็นใคร
- **Memory** บอกว่า Oracle จำอะไรได้
- **Skills** บอกว่า Oracle ทำอะไรได้

เมื่อคุณสร้าง skill ใหม่ → คุณกำลังขยายความสามารถของ Oracle

## สิ่งที่ Skill ทำได้

| ทำได้ | ตัวอย่าง |
|-------|----------|
| อ่านไฟล์ | อ่าน README แล้วสรุป |
| เขียนไฟล์ | สร้าง template ใหม่ |
| รัน command | `git log`, `npm test` |
| ค้นหา | grep, glob |
| วิเคราะห์ | review code, หา bug |
| สร้าง content | เขียน doc, แปลภาษา |

## สิ่งที่ Skill ทำไม่ได้

| ทำไม่ได้ | เหตุผล |
|----------|--------|
| เข้าถึง internet โดยตรง | Claude Code ทำงาน local |
| เก็บ state ข้าม session | skill รันจบก็จบ (ใช้ oracle-v2 สำหรับ memory) |
| รัน background process | skill ทำงานแบบ one-shot |

## พร้อมแล้ว?

ใน step ถัดไป เราจะดูว่า skill file มีโครงสร้างอะไรบ้าง — frontmatter, body, metadata

→ [Step 2: โครงสร้างของ Skill](02-anatomy-of-a-skill.md)

---

*"The Oracle Keeps the Human Human"*
