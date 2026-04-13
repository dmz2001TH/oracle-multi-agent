# บทที่ 3: กำหนด Roles ให้ Oracle

> **Abstract**: Every Oracle in an Office needs a clear role. This chapter covers common roles (Boss, Dev, Writer, QA, Designer), how to define them in CLAUDE.md, and the team table format that lets every Oracle know who does what.

## ทำไมต้องแบ่ง Role?

ถ้าทุก Oracle ทำได้ทุกอย่าง — จะเกิดปัญหา:

| ปัญหา | ตัวอย่าง |
|--------|---------|
| ทำซ้ำกัน | Dev กับ Writer เขียน README พร้อมกัน |
| ไม่มีใครรับผิดชอบ | bug เกิด — ใครแก้? |
| ตรวจงานตัวเอง | Dev เขียนโค้ดแล้ว review เอง — ไม่มี check |

**Role แก้ทุกปัญหานี้** — แต่ละตัวรู้ว่าตัวเองต้องทำอะไร และไม่ก้าวก่ายกัน

## Roles ที่ใช้บ่อย

### Boss (BoB — Bureau of Bureaucracy)

```
หน้าที่: รับงานจากมนุษย์ → แจกให้ Oracle → ตรวจผลงาน → report กลับ
ไม่ทำ: เขียนโค้ด, เขียนบทความ (แจกให้คนอื่น)
```

Boss คือ **จุดเดียว** ที่มนุษย์ต้องคุยด้วย — Boss จัดการส่วนที่เหลือ

### Dev (Developer)

```
หน้าที่: เขียนโค้ด, debug, deploy, สร้าง features
ไม่ทำ: เขียน docs (ส่งให้ Writer), test ตัวเอง (ส่งให้ QA)
```

### Writer

```
หน้าที่: เขียน docs, guides, blog posts, README
ไม่ทำ: เขียนโค้ด, ตรวจโค้ด
```

### QA (Quality Assurance)

```
หน้าที่: ตรวจโค้ด, test, review PR, หา bugs
ไม่ทำ: แก้ bug เอง (ส่งกลับ Dev)
```

### Designer

```
หน้าที่: ออกแบบ UI/UX, สร้าง mockup, เลือก color palette
ไม่ทำ: เขียน frontend code (ส่งให้ Dev)
```

### เพิ่มเติมตามต้องการ

| Role | หน้าที่ |
|------|--------|
| Researcher | ค้นคว้า, สรุปข้อมูล |
| Admin | จัดการ server, infra |
| Data | วิเคราะห์ข้อมูล, dashboards |
| HR | onboarding Oracle ใหม่, ตรวจ compliance |
| DocCon | ตรวจเอกสาร, format, conduct |

## วิธีกำหนด Role ใน CLAUDE.md

ใส่ในส่วน Identity ของ CLAUDE.md:

```markdown
## Identity

**I am**: Dev — the builder
**Purpose**: เขียนโค้ด, debug, deploy
**Born**: 2026-01-15
**Scope**: code ทุก repo ใน organization

## Scope — What Dev Does

| ทำ | ไม่ทำ |
|----|-------|
| เขียนโค้ด | เขียน docs (→ Writer) |
| Debug | Test ตัวเอง (→ QA) |
| Deploy | ออกแบบ UI (→ Designer) |
| Review PR (technical) | approve PR (→ Boss) |
```

**สำคัญ**: ต้องบอกทั้ง "ทำอะไร" และ **"ไม่ทำอะไร"** — ไม่งั้น Oracle จะทำทุกอย่าง

## Team Table — ให้ทุก Oracle รู้จักกัน

ใส่ตาราง Team ใน CLAUDE.md ของ **ทุกตัว**:

```markdown
## Team Communication

| Oracle | Role | เมื่อไหร่ต้องคุย |
|--------|------|-----------------|
| bob    | Boss | report งาน, ขอ approval, ติดปัญหา |
| dev    | Dev  | ส่งงาน code, ถามเรื่อง technical |
| writer | Writer | ส่งงาน docs, ขอ content |
| qa     | QA | ส่ง PR ให้ review, report bug |
| designer | Designer | ขอ design, UI specs |
```

### วิธีคุย

```markdown
### วิธีคุย

- **Primary**: `/talk-to <oracle> "message"`
- **Fallback**: `maw hey <oracle> "message"`
- **cc Boss ทุกครั้ง**: `/talk-to bob "cc: [สิ่งที่ทำ]"`
```

## Chain of Command

ทุก Office ต้องมี chain of command ชัดเจน:

```
มนุษย์ (คุณ)
    │
    ▼
   Boss ← รับคำสั่ง, ส่งต่อ, ตรวจงาน
    │
    ├── Dev ← เขียนโค้ด
    ├── Writer ← เขียน content
    ├── QA ← ตรวจสอบ
    └── Designer ← ออกแบบ
```

**กฎสำคัญ**:
1. มนุษย์สั่ง Boss — Boss สั่ง Oracle อื่น
2. Oracle report กลับ Boss — Boss report กลับมนุษย์
3. Oracle คุยกันได้โดยตรง — แต่ **ต้อง cc Boss เสมอ**

## Pattern: CLAUDE.md Team Section Template

Copy template นี้ไปใส่ใน CLAUDE.md ของทุก Oracle:

```markdown
## Team

**The team**: bob, dev, writer, qa, designer

| Oracle | Role | Contact |
|--------|------|---------|
| bob | Boss — สั่งงาน, ตรวจงาน | /talk-to bob |
| dev | Dev — เขียนโค้ด | /talk-to dev |
| writer | Writer — เขียน content | /talk-to writer |
| qa | QA — ตรวจสอบ | /talk-to qa |
| designer | Designer — ออกแบบ | /talk-to designer |

### cc BoB ทุกครั้ง
เมื่อคุยกับ oracle อื่น → `/talk-to bob "cc: [สิ่งที่ทำ]"`
```

## Checklist

- [ ] ทุก Oracle มี role ชัดเจน — ทั้ง "ทำ" และ "ไม่ทำ"
- [ ] CLAUDE.md มี Identity + Scope section
- [ ] ทุกตัวมี Team table เหมือนกัน
- [ ] Chain of command ชัด — Boss อยู่ตรงกลาง

---

> [บทที่ 4: ตั้งกฎ Office](04-rules.md)
