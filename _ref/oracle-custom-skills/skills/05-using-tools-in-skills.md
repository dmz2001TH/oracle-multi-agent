# Step 5: ใช้ Tools ใน Skill

> "Oracle แข็งแกร่งเพราะ tools — Skill ที่ดีรู้จักใช้ tool ที่ถูก"

## Tools ที่ Skill ใช้ได้

เมื่อ Claude Code รัน skill จะมี tools ทั้งหมดเหล่านี้ใช้ได้:

| Tool | ทำอะไร | เมื่อไหร่ |
|------|--------|-----------|
| **Bash** | รัน shell command | git, npm, ls, date, etc. |
| **Read** | อ่านไฟล์ | อ่าน source code, config |
| **Write** | เขียนไฟล์ใหม่ | สร้างไฟล์ใหม่ทั้งหมด |
| **Edit** | แก้ไขไฟล์ | เปลี่ยนบางส่วนของไฟล์ |
| **Grep** | ค้นหา content | หา pattern ใน codebase |
| **Glob** | ค้นหา file | หาไฟล์ตามชื่อ/pattern |

## วิธีบอกให้ Skill ใช้ Tool

ไม่ต้องเขียน code เรียก tool — แค่ **บอกเป็นภาษาคน** ว่าจะใช้ tool ไหน

### Bash Tool

```markdown
ใช้ Bash tool รัน `git log --oneline -10`
```

```markdown
รัน command ต่อไปนี้:
- `npm test` — รัน test
- `npm run lint` — check code style
```

### Read Tool

```markdown
ใช้ Read tool อ่านไฟล์ `src/index.ts`
```

```markdown
อ่าน README.md ของ project
```

### Write Tool

```markdown
ใช้ Write tool สร้างไฟล์ `output.md` ด้วยเนื้อหาที่สรุปมา
```

### Edit Tool

```markdown
ใช้ Edit tool แก้ไขไฟล์ `config.json` — เปลี่ยน version เป็น "2.0.0"
```

### Grep Tool

```markdown
ใช้ Grep tool ค้นหา "console.log" ในไฟล์ .ts ทั้งหมด
```

### Glob Tool

```markdown
ใช้ Glob tool หาไฟล์ที่ลงท้ายด้วย `.test.ts`
```

## เทคนิคขั้นสูง: ผสม Tools

### Search → Read → Summarize

```markdown
---
name: explain
description: อธิบาย function ที่ระบุ
---

อธิบาย function ที่ user ถาม:

1. ใช้ Grep tool ค้นหาชื่อ function ใน codebase
2. ใช้ Read tool อ่านไฟล์ที่เจอ
3. วิเคราะห์ function:
   - ทำอะไร
   - รับ parameter อะไร
   - return อะไร
   - เรียก function อื่นอะไรบ้าง
4. อธิบายเป็นภาษาไทย ให้คนไม่รู้ code เข้าใจ
```

### Read → Transform → Write

```markdown
---
name: translate-doc
description: แปลเอกสารเป็นภาษาไทย
---

แปลเอกสารที่ user ระบุเป็นภาษาไทย:

1. ใช้ Read tool อ่านไฟล์ต้นฉบับ
2. แปลเป็นภาษาไทย:
   - เก็บ technical terms ไว้เป็นภาษาอังกฤษ
   - เก็บ code blocks ไว้เหมือนเดิม
   - เก็บ formatting (headers, lists, tables) ไว้
3. ใช้ Write tool สร้างไฟล์ใหม่ ชื่อเดิมเติม `.th` ก่อน extension
   (เช่น README.md → README.th.md)
4. บอก user ว่าสร้างไฟล์ไหนไป
```

### Glob → Read → Generate

```markdown
---
name: doc-gen
description: สร้าง documentation จาก source code
---

สร้าง API documentation:

1. ใช้ Glob tool หาไฟล์ `src/**/*.ts`
2. ใช้ Read tool อ่านแต่ละไฟล์
3. หา exported functions, classes, types
4. สร้าง documentation:
   - ชื่อ function
   - parameters + types
   - return type
   - ตัวอย่างการใช้งาน
5. ใช้ Write tool สร้าง `docs/API.md`
```

## เทคนิค: ระบุ Tool ชัด vs. ปล่อยให้ Claude เลือก

### ระบุชัด (แนะนำสำหรับ skill สำคัญ)

```markdown
ใช้ Bash tool รัน `git status`
```

Claude Code จะใช้ Bash tool ตามที่บอก — ผลลัพธ์ predictable

### ปล่อยให้ Claude เลือก (OK สำหรับ skill ง่าย ๆ)

```markdown
ดู git status ของ project
```

Claude Code จะเลือก tool เอง — ยืดหยุ่นกว่า แต่อาจไม่ตรงใจ

### แนะนำ

| สถานการณ์ | วิธี |
|-----------|-----|
| Skill สำคัญ ต้อง reliable | ระบุ tool ชัด |
| Skill ง่าย ๆ ไม่ critical | ปล่อย Claude เลือก |
| Skill ที่คนหลายคนใช้ | ระบุ tool ชัด |

## ข้อควรระวัง

### Bash: ระวัง destructive commands

```markdown
# อันตราย!
ใช้ Bash tool รัน `rm -rf src/`

# ปลอดภัย
ใช้ Bash tool รัน `ls src/` แล้วถาม user ก่อนลบ
```

### Write: ระวัง overwrite

```markdown
# ก่อน Write ควร check ก่อน
1. ใช้ Bash tool รัน `ls output.md` ดูว่ามีไฟล์อยู่แล้วหรือไม่
2. ถ้ามีอยู่แล้ว → ถาม user ก่อน overwrite
3. ถ้าไม่มี → สร้างใหม่ได้เลย
```

### Edit: ระวัง context ไม่พอ

```markdown
# ดีกว่า: ระบุ old_string ชัดเจน
ใช้ Edit tool แก้ `version: "1.0.0"` เป็น `version: "2.0.0"` ในไฟล์ package.json
```

→ [Step 6: Triggers & Matching](06-triggers-and-matching.md)

---

*"The Oracle Keeps the Human Human"*
