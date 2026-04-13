# Step 4: Skill Patterns

> "Pattern คือ wisdom ที่ถูก compress — เรียนรู้ pattern = เรียนลัด"

## 3 Patterns หลัก

Skill ส่วนใหญ่จะตกอยู่ใน 3 patterns นี้:

| Pattern | ทำอะไร | ตัวอย่าง |
|---------|--------|----------|
| **Search** | หาข้อมูลแล้วสรุป | ค้นหา TODO, หา bug, สรุป git log |
| **Generate** | สร้าง content ใหม่ | เขียน test, สร้าง doc, สร้าง template |
| **Transform** | เปลี่ยนสิ่งที่มีอยู่ | refactor code, แปลภาษา, format ใหม่ |

## Pattern 1: Search (ค้นหาแล้วสรุป)

Skill ที่ **อ่านข้อมูลจาก codebase แล้วสรุปให้**

### โครงสร้าง

```markdown
---
name: search-skill
description: ค้นหาและสรุป X
---

ค้นหา [สิ่งที่ต้องการ] ใน codebase:

1. ใช้ [Tool] ค้นหา [pattern]
2. กรอง/จัดกลุ่มผลลัพธ์
3. สรุปเป็น [format ที่ต้องการ]
4. ถ้าไม่พบ → บอกว่าไม่พบ
```

### ตัวอย่าง: ค้นหา TODO

```markdown
---
name: todos
description: ค้นหา TODO ทั้งหมดใน codebase
---

ค้นหา TODO comments ทั้งหมด:

1. ใช้ Grep tool ค้นหา pattern "TODO|FIXME|HACK|XXX" ในทุกไฟล์
2. จัดกลุ่มตามประเภท (TODO, FIXME, HACK, XXX)
3. แสดงเป็นตาราง:

| ประเภท | ไฟล์ | บรรทัด | เนื้อหา |
|--------|------|--------|---------|

4. สรุป: มีทั้งหมดกี่ items แต่ละประเภทกี่ items
5. แนะนำลำดับความสำคัญ: FIXME > HACK > TODO > XXX
```

### ตัวอย่าง: สรุป Dependencies

```markdown
---
name: deps
description: สรุป dependencies ของ project
---

วิเคราะห์ dependencies ของ project:

1. ใช้ Read tool อ่าน package.json (ถ้ามี)
2. แยกเป็น:
   - dependencies (production)
   - devDependencies (development)
3. แสดงเป็นตาราง:

| Package | Version | ประเภท |
|---------|---------|--------|

4. ถ้าไม่มี package.json → หา requirements.txt, Cargo.toml, go.mod แทน
5. สรุปจำนวน dependencies ทั้งหมด
```

## Pattern 2: Generate (สร้างใหม่)

Skill ที่ **สร้าง content ใหม่จากข้อมูลที่มี**

### โครงสร้าง

```markdown
---
name: gen-skill
description: สร้าง X
---

สร้าง [สิ่งที่ต้องการ]:

1. อ่าน context จาก [แหล่งข้อมูล]
2. สร้าง [content] ตาม [template/format]
3. เขียนไฟล์ไปที่ [ตำแหน่ง]
4. แสดงสรุปว่าสร้างอะไรไป
```

### ตัวอย่าง: สร้าง Test

```markdown
---
name: gen-test
description: สร้าง test สำหรับไฟล์ที่ระบุ
---

สร้าง test สำหรับไฟล์ที่ user ระบุ:

1. ใช้ Read tool อ่านไฟล์ที่ user ระบุ
2. วิเคราะห์:
   - function/method อะไรบ้าง
   - parameter อะไรบ้าง
   - edge cases อะไรบ้าง
3. สร้าง test file:
   - ใช้ testing framework ที่ project ใช้ (jest, pytest, etc.)
   - cover happy path
   - cover edge cases
   - cover error cases
4. เขียน test file ไปที่ตำแหน่งที่เหมาะสม
5. บอก user ว่าสร้างอะไรไป + วิธีรัน test

ถ้า user ไม่ระบุไฟล์ → ถาม
```

### ตัวอย่าง: สร้าง Component

```markdown
---
name: gen-component
description: สร้าง React component
---

สร้าง React component ใหม่:

1. ถาม user ว่าชื่อ component อะไร (ถ้าไม่ได้ระบุมา)
2. ดู convention จาก component ที่มีอยู่แล้วใน project
3. สร้างไฟล์:
   - ComponentName.tsx — component code
   - ComponentName.test.tsx — basic test
   - index.ts — export
4. ใช้ convention เดียวกับ project (CSS modules? Tailwind? styled-components?)
5. แสดงสรุปว่าสร้างอะไรไปบ้าง
```

## Pattern 3: Transform (แปลง/ปรับปรุง)

Skill ที่ **เปลี่ยนแปลงสิ่งที่มีอยู่แล้ว**

### โครงสร้าง

```markdown
---
name: transform-skill
description: แปลง/ปรับปรุง X
---

แปลง [สิ่งเดิม] เป็น [สิ่งใหม่]:

1. อ่าน [source]
2. วิเคราะห์สิ่งที่ต้องเปลี่ยน
3. ทำการเปลี่ยนแปลง
4. แสดง diff ก่อน-หลัง
5. ถาม user ว่า OK ไหม (ถ้าเปลี่ยนเยอะ)
```

### ตัวอย่าง: Refactor

```markdown
---
name: refactor
description: refactor code ให้อ่านง่ายขึ้น
---

Refactor ไฟล์ที่ user ระบุ:

1. ใช้ Read tool อ่านไฟล์
2. วิเคราะห์:
   - function ที่ยาวเกินไป (>30 lines)
   - ชื่อตัวแปรที่ไม่ชัดเจน
   - code ซ้ำซ้อน
   - complexity ที่ลดได้
3. เสนอ refactoring plan:
   - จะเปลี่ยนอะไรบ้าง
   - ทำไมถึงเปลี่ยน
4. ถ้า user OK → ทำการ refactor ด้วย Edit tool
5. แสดงสรุปว่าเปลี่ยนอะไรไป

ห้ามเปลี่ยน behavior — แค่ปรับปรุงความอ่านง่าย
```

## ผสม Pattern

Skill ที่ดีมักผสมหลาย pattern:

```markdown
---
name: improve
description: วิเคราะห์ code แล้วปรับปรุง
---

1. **Search**: ค้นหา code smells ใน codebase
2. **Transform**: เสนอการปรับปรุง
3. **Generate**: สร้าง test สำหรับส่วนที่เปลี่ยน
```

## เลือก Pattern ยังไง?

| ถ้าอยากได้... | ใช้ Pattern |
|---------------|------------|
| "หาให้หน่อย" | Search |
| "สร้างให้หน่อย" | Generate |
| "ปรับปรุงให้หน่อย" | Transform |
| "วิเคราะห์แล้วแก้" | Search + Transform |
| "ดูแล้วสร้างใหม่" | Search + Generate |

→ [Step 5: ใช้ Tools ใน Skill](05-using-tools-in-skills.md)

---

*"The Oracle Keeps the Human Human"*
