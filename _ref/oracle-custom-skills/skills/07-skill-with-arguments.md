# Step 7: Skill กับ Arguments

> "Skill ที่รับ input = Skill ที่ยืดหยุ่น"

## Arguments คืออะไร?

เมื่อ user พิมพ์ `/skill-name ข้อความเพิ่มเติม` — ส่วน "ข้อความเพิ่มเติม" คือ **argument**

```
/hello แบงค์
       ↑ argument = "แบงค์"

/review src/index.ts
        ↑ argument = "src/index.ts"

/gen-test src/utils.ts --verbose
          ↑ argument = "src/utils.ts --verbose"
```

## วิธีใช้ Arguments ใน Skill

ไม่ต้องเขียน code parse — แค่ **บอกใน prompt** ว่า argument คืออะไร

### วิธีง่ายที่สุด

```markdown
---
name: hello
description: ทักทาย
---

ทักทาย user

ถ้า user ใส่ชื่อมาหลัง /hello → ใช้ชื่อนั้นทักทาย
ถ้าไม่ใส่ → ทักทายแบบทั่วไป
```

### User พิมพ์

```
/hello แบงค์    → "สวัสดีครับ แบงค์!"
/hello          → "สวัสดีครับ!"
```

## Patterns สำหรับ Arguments

### Pattern 1: Single Argument (ไฟล์หรือชื่อ)

```markdown
---
name: explain
description: อธิบาย function หรือไฟล์
---

อธิบายสิ่งที่ user ระบุ:

ถ้า user ใส่ชื่อไฟล์ (เช่น src/index.ts):
1. ใช้ Read tool อ่านไฟล์นั้น
2. อธิบายว่าไฟล์ทำอะไร

ถ้า user ใส่ชื่อ function:
1. ใช้ Grep tool ค้นหา function นั้นใน codebase
2. อ่านไฟล์ที่เจอ
3. อธิบาย function

ถ้า user ไม่ใส่อะไร:
→ ถามว่าอยากให้อธิบายอะไร
```

### Pattern 2: Multiple Arguments

```markdown
---
name: compare
description: เปรียบเทียบ 2 ไฟล์
---

เปรียบเทียบ 2 ไฟล์ที่ user ระบุ:

User จะใส่ 2 path เช่น: /compare file1.ts file2.ts

1. ใช้ Read tool อ่านไฟล์แรก
2. ใช้ Read tool อ่านไฟล์ที่สอง
3. เปรียบเทียบ:
   - โครงสร้างต่างกันยังไง
   - function ที่มีเหมือนกัน/ต่างกัน
   - style ต่างกันไหม
4. สรุปเป็นตาราง

ถ้า user ใส่ไฟล์เดียว → ถามว่าจะเทียบกับไฟล์ไหน
ถ้าไม่ใส่เลย → ถามว่าจะเทียบไฟล์ไหน
```

### Pattern 3: Flag-style Arguments

```markdown
---
name: log
description: ดู git log แบบต่าง ๆ
---

แสดง git log ตาม option ที่ user ระบุ:

- `/log` → แสดง 10 commits ล่าสุด
- `/log today` → แสดง commits ของวันนี้
- `/log week` → แสดง commits ของสัปดาห์นี้
- `/log ชื่อคน` → แสดง commits ของคนนั้น

ใช้ Bash tool รัน git log ด้วย option ที่เหมาะสม:
- default: `git log --oneline -10`
- today: `git log --oneline --since="today"`
- week: `git log --oneline --since="1 week ago"`
- ชื่อคน: `git log --oneline --author="ชื่อ"`

แสดงผลเป็นตาราง:
| Hash | Message | Author | Date |
```

### Pattern 4: Free-form Input

```markdown
---
name: ask
description: ถาม Oracle อะไรก็ได้เกี่ยวกับ codebase
---

ตอบคำถามของ user เกี่ยวกับ codebase นี้:

1. อ่านคำถามจาก argument ที่ user ใส่มา
2. ค้นหาข้อมูลที่เกี่ยวข้อง:
   - ใช้ Grep tool ค้นหา keywords จากคำถาม
   - ใช้ Read tool อ่านไฟล์ที่เกี่ยวข้อง
   - ใช้ Glob tool หาไฟล์ที่น่าจะเกี่ยว
3. ตอบคำถามพร้อมอ้างอิงไฟล์/บรรทัดที่เกี่ยวข้อง

ถ้า user ไม่ใส่คำถาม → ถามว่าอยากรู้อะไร
```

## เทคนิค: ทำให้ Skill ฉลาดกับ Arguments

### ตรวจจับ type อัตโนมัติ

```markdown
---
name: open
description: เปิดไฟล์หรือ URL
---

ดู argument ที่ user ใส่มา:

ถ้าเป็น file path (มี / หรือ . ในชื่อ):
→ ใช้ Read tool อ่านไฟล์นั้น

ถ้าเป็น URL (เริ่มด้วย http):
→ ใช้ Bash tool รัน `curl -s URL | head -50`

ถ้าเป็นชื่อ function:
→ ใช้ Grep tool ค้นหาใน codebase

ถ้าไม่ใส่อะไร:
→ ถามว่าจะเปิดอะไร
```

### Default values

```markdown
ถ้า user ไม่ระบุจำนวน → ใช้ 10 เป็น default
ถ้า user ไม่ระบุ format → ใช้ table เป็น default
ถ้า user ไม่ระบุภาษา → ใช้ภาษาไทย
```

## ข้อผิดพลาดที่พบบ่อย

| ผิด | ถูก |
|-----|-----|
| ไม่ handle กรณีไม่มี argument | มี fallback "ถ้าไม่ใส่ → ถาม/ใช้ default" |
| สมมติว่า argument เป็น file เสมอ | ตรวจจับ type ก่อน |
| ไม่บอก user ว่าใส่อะไรได้ | มี usage guide ใน description |

## ทดลอง

สร้าง `.claude/skills/greet.md`:

```markdown
---
name: greet
description: ทักทายในภาษาต่าง ๆ
---

ทักทาย user ในภาษาที่ระบุ:

- `/greet thai` → ทักทายภาษาไทย
- `/greet japanese` → ทักทายภาษาญี่ปุ่น
- `/greet english` → ทักทายภาษาอังกฤษ
- `/greet` (ไม่ระบุ) → ทักทายภาษาไทย (default)

ถ้า user ระบุชื่อด้วย เช่น `/greet japanese แบงค์`
→ ทักทายด้วยชื่อนั้นในภาษาที่เลือก
```

→ [Step 8: ทดสอบ Skill](08-testing-your-skill.md)

---

*"The Oracle Keeps the Human Human"*
