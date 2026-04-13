# Step 10: ตัวอย่างจริงจาก Oracle Ecosystem

> "เรียนจาก pattern จริง ไม่ใช่ทฤษฎี"

## Skills ที่ใช้จริงใน Oracle Office

Oracle Office ของแบงค์ใช้ skills หลายตัวในงานจริงทุกวัน นี่คือตัวอย่างที่น่าสนใจ:

## 1. /recap — สรุป Session

Skill ที่ใช้บ่อยที่สุด: สรุปว่า session นี้ทำอะไรไปบ้าง

```markdown
---
name: recap
description: สรุป session — ทำอะไรไป, เรียนรู้อะไร, ค้างอะไร
---

สรุป session นี้:

1. ใช้ Bash tool ดู git log ตั้งแต่เริ่ม session:
   `git log --oneline --since="4 hours ago"`

2. ใช้ Bash tool ดู files ที่เปลี่ยน:
   `git diff --stat HEAD~5`

3. สรุปเป็น 3 ส่วน:

## สิ่งที่ทำ
- bullet points ของงานที่ทำ

## สิ่งที่เรียนรู้
- insights, patterns ที่ค้นพบ

## สิ่งที่ค้าง
- งานที่ยังไม่เสร็จ, ต้องทำต่อ

Tone: กระชับ ภาษาไทย
```

**ทำไมดี:**
- มี structure ชัดเจน (ทำ/เรียน/ค้าง)
- ใช้ git log เป็น source of truth
- output consistent ทุกครั้ง

## 2. /rrr — Retrospective

Skill สำหรับปิด session — สร้าง retrospective แล้ว commit

```markdown
---
name: rrr
description: Session retrospective — เขียน retro แล้ว commit
---

สร้าง session retrospective:

1. สรุปงานจาก git log
2. เขียนไฟล์ retro ไปที่ ψ/memory/retros/
   - ชื่อไฟล์: YYYY-MM-DD-retro.md
   - เนื้อหา: สิ่งที่ทำ, สิ่งที่เรียน, สิ่งที่ปรับปรุง
3. git add + commit ด้วย message "docs: session retro"
4. git push

ห้ามลืม push — retro ที่ไม่ push = retro ที่หาย
```

**ทำไมดี:**
- ทำ 3 อย่างใน command เดียว: เขียน → commit → push
- enforce discipline: ทุก session ต้องมี retro

## 3. /standup — Daily Standup

```markdown
---
name: standup
description: สร้าง daily standup report
---

สร้าง daily standup:

1. ใช้ Bash tool รัน `git log --oneline --since="yesterday" --author="$(git config user.name)"`
2. ใช้ Bash tool รัน `git diff --stat`
3. ดู TODO/FIXME ที่ค้างอยู่ (ใช้ Grep tool ค้น TODO)

สรุปเป็น:

## Yesterday
- สิ่งที่ทำเมื่อวาน (จาก git log)

## Today
- สิ่งที่จะทำวันนี้ (จาก TODO ที่ค้าง + context)

## Blockers
- ปัญหาที่ติด (ถ้ามี, ถ้าไม่มีก็บอกว่าไม่มี)
```

## 4. /learn — บันทึกการเรียนรู้

```markdown
---
name: learn
description: บันทึกสิ่งที่เรียนรู้ลง memory
---

บันทึกสิ่งที่ user บอกลงใน ψ/learn/:

1. รับ input จาก user (argument)
2. สร้างไฟล์ใน ψ/learn/ ด้วยชื่อที่เหมาะสม
3. เนื้อหา:
   - วันที่
   - สิ่งที่เรียนรู้
   - context (เกี่ยวกับอะไร)
   - source (เรียนจากไหน)
4. git add + commit

ถ้า user ไม่ใส่ argument → ถามว่าเรียนรู้อะไร
```

## 5. /review — Code Review อัตโนมัติ

```markdown
---
name: review
description: review staged changes อย่างละเอียด
---

Review code changes:

1. ใช้ Bash tool รัน `git diff --staged`
2. ถ้าไม่มี staged → รัน `git diff`
3. ถ้าไม่มี changes เลย → บอก "ไม่มี changes"

สำหรับแต่ละไฟล์ที่เปลี่ยน วิเคราะห์:

| Category | Check |
|----------|-------|
| Bugs | มี potential bug ไหม? |
| Security | มี security concern ไหม? |
| Performance | มี performance issue ไหม? |
| Style | ตาม convention ไหม? |
| Logic | logic ถูกต้องไหม? |

ให้ score:
- ✅ Good (พร้อม merge)
- ⚠️ Suggestion (มี recommendation)
- ❌ Issue (ต้องแก้ก่อน)

สรุปสุดท้าย: พร้อม merge ไหม? ใช่/ไม่ พร้อมเหตุผล
```

## 6. /trace — ติดตาม Decision

```markdown
---
name: trace
description: บันทึก decision + เหตุผล
---

บันทึก decision ที่ทำ:

1. รับ decision จาก user argument
2. บันทึก:
   - Decision: อะไร
   - Context: ทำไมถึงตัดสินใจ
   - Alternatives: ทางเลือกอื่นที่พิจารณา
   - Outcome: คาดว่าจะเกิดอะไร
3. เก็บไว้ใน oracle-v2 memory (ถ้ามี) หรือ ψ/memory/
4. ใส่ timestamp

Decision ที่ไม่มี trace = ตัดสินใจโดยไม่มีหลักฐาน
```

## Pattern ที่เห็นจากตัวอย่างจริง

### 1. Skill ดี ๆ มักจะ compound

ทำหลายอย่างในคำสั่งเดียว: อ่าน → วิเคราะห์ → เขียน → commit

### 2. มี fallback เสมอ

"ถ้าไม่มี X → ทำ Y" ไม่มี dead end

### 3. Output มี structure

ใช้ headers, tables, bullet points → อ่านง่าย consistent

### 4. เชื่อมกับ workflow

Skill ไม่ได้อยู่โดดเดี่ยว — มันเป็นส่วนหนึ่งของ workflow:
- เริ่ม session → `/standup`
- ระหว่างงาน → `/review`
- เรียนรู้อะไร → `/learn`
- จบ session → `/rrr`

### 5. Enforce discipline

Skill ช่วย enforce practice ที่ดี:
- ต้องมี retro ทุก session
- ต้อง review ก่อน commit
- ต้องบันทึกการเรียนรู้

## ลองสร้าง Skill ของคุณเอง

ตอนนี้คุณรู้แล้วว่า:
- Skill คืออะไร (Step 1-2)
- สร้างยังไง (Step 3)
- Patterns อะไรบ้าง (Step 4)
- ใช้ tools ยังไง (Step 5)
- Triggers ทำงานยังไง (Step 6)
- Arguments จัดการยังไง (Step 7)
- ทดสอบยังไง (Step 8)
- แชร์ยังไง (Step 9)
- ตัวอย่างจริงเป็นยังไง (Step 10)

**ขั้นตอนถัดไป:**
1. คิดว่ามีอะไรที่ทำซ้ำ ๆ ทุกวัน
2. เขียน skill สำหรับมัน
3. ทดสอบ + ปรับปรุง
4. แชร์ใน community

> "ทุก skill ที่คุณสร้าง = คุณกำลังสอน Oracle สิ่งใหม่
> ทุก skill ที่คุณแชร์ = คุณกำลังสร้าง Oracle ให้โลก"

## มีคำถาม?

เปิด Discussion ได้เลย — ทีมพร้อมช่วย

---

*"The Oracle Keeps the Human Human"*
