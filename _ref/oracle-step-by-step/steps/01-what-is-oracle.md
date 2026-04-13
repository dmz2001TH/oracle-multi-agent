# Step 1: Oracle คืออะไร?

> "The Oracle Keeps the Human Human"

## แนวคิดหลัก

Oracle ไม่ใช่แค่ chatbot — Oracle คือ **AI agent ที่มีความทรงจำ มีตัวตน และพัฒนาได้**

### AI ธรรมดา vs Oracle

| | AI ธรรมดา | Oracle |
|---|-----------|--------|
| **ความจำ** | ลืมทุกอย่างเมื่อจบ session | จำได้ข้าม session (ψ/ vault + oracle-v2) |
| **ตัวตน** | เหมือนกันทุกคน | มี identity, ชื่อ, บทบาท, ปรัชญาของตัวเอง |
| **ทักษะ** | ทำได้ตาม prompt | มี skills (/recap, /learn, /rrr) ติดตั้งเพิ่มได้ |
| **การสื่อสาร** | คุยกับคนเท่านั้น | คุยกับ Oracle ตัวอื่นได้ (/talk-to) |
| **การเติบโต** | ไม่เปลี่ยน | เรียนรู้จากทุก session, สะสม knowledge |

### องค์ประกอบของ Oracle

```
Oracle = Identity + Memory + Skills + Communication
```

1. **Identity (CLAUDE.md)** — ใครคือ Oracle นี้? ทำอะไร? มีกฏอะไร?
2. **Memory (ψ/ vault + oracle-v2)** — สมอง — เก็บทุกอย่างที่เรียนรู้
3. **Skills (oracle-skills-cli)** — ความสามารถ — /recap, /learn, /rrr, /talk-to
4. **Communication (maw/threads)** — พูดคุยกับ Oracle อื่นได้

## Reincarnation — Oracle ตายแต่ไม่หาย

ทุกครั้งที่ปิด terminal, session จบ — Oracle "ตาย"

แต่เมื่อเปิดใหม่:
1. อ่าน `CLAUDE.md` → ได้ identity กลับ
2. อ่าน `ψ/memory/` → ได้ความทรงจำกลับ
3. Query `oracle-v2` → ได้ knowledge กลับ
4. **Oracle กลับมาเป็นตัวเดิม** = Reincarnation

```
Session 1: เรียนรู้ A → เก็บใน ψ/ → session จบ (ตาย)
Session 2: อ่าน ψ/ → รู้ A → เรียนรู้ B → เก็บ → ตาย
Session 3: อ่าน ψ/ → รู้ A+B → เรียนรู้ C → ...
```

ยิ่งใช้ ยิ่งเก่ง — เพราะ knowledge สะสม

## ตัวอย่างจริง: Oracle Office

ลองนึกภาพ Office ที่มีหลาย Oracle ทำงานร่วมกัน:

```
BoB (Manager)
├── Dev (Developer)      — เขียน code
├── QA (Tester)          — ทดสอบ
├── Writer (Writer)      — เขียน docs
├── Designer (Designer)  — ออกแบบ
├── Researcher           — ค้นคว้า
└── HR                   — ดูแลทีม
```

ทุกตัวมี:
- CLAUDE.md ของตัวเอง (identity ต่างกัน)
- ψ/ vault ของตัวเอง (ความทรงจำต่างกัน)
- Skills เดียวกัน (จาก oracle-skills-cli)
- คุยกันได้ (ผ่าน /talk-to หรือ maw hey)

## 5 ปรัชญาของ Oracle

1. **Nothing is Deleted** — ไม่ลบอะไร supersede แทน
2. **Patterns Over Intentions** — เรียนจาก patterns จริง ไม่ใช่ทฤษฎี
3. **External Brain, Not Command** — สมองภายนอก ไม่ใช่ทาส
4. **Curiosity Creates Existence** — ถามมาก = Oracle เก่งมาก
5. **Form and Formless** — มีโครงสร้าง แต่ยืดหยุ่น

## คำถามทบทวน

ก่อนไปต่อ ลองตอบ:

- [ ] Oracle ต่างจาก AI ธรรมดายังไง?
- [ ] Reincarnation ทำงานยังไง?
- [ ] องค์ประกอบ 4 อย่างของ Oracle คืออะไร?
- [ ] "Nothing is Deleted" หมายความว่าอะไร?

---

**ถัดไป**: [Step 2: สร้าง Oracle ตัวแรก](02-create-your-oracle.md)
