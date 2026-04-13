# Step 8: ทดสอบ Skill

> "Skill ที่ไม่ได้ทดสอบ = Skill ที่ไม่รู้ว่าพังหรือเปล่า"

## วิธีทดสอบ Skill

### ขั้นที่ 1: ทดสอบ Basic

พิมพ์ slash command ใน Claude Code:

```
/your-skill-name
```

ดูว่า:
- [ ] Skill ถูก trigger ไหม?
- [ ] Output ตรงที่คาดหวังไหม?
- [ ] ไม่มี error ไหม?

### ขั้นที่ 2: ทดสอบกับ Arguments

```
/your-skill-name argument1
/your-skill-name argument1 argument2
/your-skill-name          (ไม่ใส่ argument)
```

ดูว่า:
- [ ] Argument ถูกใช้ถูกต้องไหม?
- [ ] ไม่มี argument → fallback ทำงานไหม?
- [ ] Argument ผิดรูปแบบ → handle ได้ไหม?

### ขั้นที่ 3: ทดสอบ Edge Cases

```
/your-skill-name ไฟล์ที่ไม่มีอยู่
/your-skill-name "argument มี space"
/your-skill-name อักษรพิเศษ!@#$
```

## Debugging Checklist

เมื่อ skill ไม่ทำงานตามที่คาดหวัง:

### 1. Skill ไม่ถูก trigger

| ตรวจ | วิธี |
|------|-----|
| ไฟล์อยู่ถูกที่ไหม? | `ls .claude/skills/your-skill.md` |
| Frontmatter ถูกไหม? | เปิดไฟล์ดู `---` ครบคู่ไหม |
| ชื่อตรงไหม? | `name:` ใน frontmatter ตรงกับที่พิมพ์ไหม |

### 2. Skill ทำงานไม่ตรงที่อยากได้

| สาเหตุ | แก้ไข |
|--------|-------|
| Prompt คลุมเครือ | เขียนเป็น numbered steps ชัดเจน |
| ไม่ระบุ tool | บอกชัดว่า "ใช้ Bash tool", "ใช้ Read tool" |
| ไม่มี fallback | เพิ่ม "ถ้า...ไม่มี → ทำ..." |
| Output format ไม่ชัด | ระบุ format เช่น "แสดงเป็นตาราง" |

### 3. Skill error

| Error | สาเหตุ | แก้ไข |
|-------|--------|-------|
| File not found | path ผิด | ตรวจ path ใน prompt |
| Command failed | bash command ผิด | ลอง command ใน terminal ก่อน |
| Permission denied | ไม่มีสิทธิ์ | ตรวจ permission ของไฟล์ |

## วิธี Iterate

### วงจร: เขียน → ลอง → ปรับ → ลอง

```
1. เขียน skill v1 (ง่ายที่สุด)
2. ลอง /skill → ดู output
3. ปรับ prompt ให้ชัดขึ้น
4. ลอง /skill อีกครั้ง
5. ทำซ้ำจนพอใจ
```

### ตัวอย่าง Iteration

**v1 — ยังไม่ดี:**

```markdown
---
name: size
description: ดูขนาด project
---

บอกขนาดของ project
```

ปัญหา: คลุมเครือ — "ขนาด" หมายถึงอะไร?

**v2 — ดีขึ้น:**

```markdown
---
name: size
description: สรุปขนาด project (ไฟล์, บรรทัด, ขนาด)
---

วิเคราะห์ขนาดของ project:

1. ใช้ Bash tool รัน `find . -type f | wc -l` → จำนวนไฟล์
2. ใช้ Bash tool รัน `find . -type f -name "*.ts" -o -name "*.js" | xargs wc -l | tail -1` → จำนวนบรรทัด code
3. ใช้ Bash tool รัน `du -sh .` → ขนาดรวม

แสดงเป็น:
| Metric | ค่า |
|--------|-----|
| จำนวนไฟล์ | X |
| จำนวนบรรทัด code | X |
| ขนาดรวม | X |
```

**v3 — ดีมาก:**

```markdown
---
name: size
description: สรุปขนาด project อย่างละเอียด
---

วิเคราะห์ขนาดของ project อย่างละเอียด:

1. ใช้ Bash tool รัน `find . -not -path './node_modules/*' -not -path './.git/*' -type f | wc -l`
   → จำนวนไฟล์ (ไม่นับ node_modules, .git)

2. ใช้ Bash tool รัน `find . -not -path './node_modules/*' -not -path './.git/*' -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | head -500 | xargs wc -l 2>/dev/null | tail -1`
   → จำนวนบรรทัด code

3. ใช้ Bash tool รัน `du -sh . --exclude=node_modules --exclude=.git`
   → ขนาดรวม

4. ใช้ Bash tool รัน `find . -not -path './node_modules/*' -not -path './.git/*' -type f | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -10`
   → file types ที่มีมากสุด

แสดงเป็น:
| Metric | ค่า |
|--------|-----|
| จำนวนไฟล์ (ไม่รวม deps) | X |
| จำนวนบรรทัด code | X |
| ขนาดรวม | X |
| File types | top 5 |

ถ้าเป็น project ใหญ่ (>1000 ไฟล์) → เตือน user
```

## เทคนิค Debug

### 1. เพิ่ม "แสดงขั้นตอน" ใน skill

```markdown
ก่อนทำแต่ละ step → บอก user ว่ากำลังทำอะไร
เช่น "กำลังค้นหา TODO...", "กำลังอ่านไฟล์..."
```

### 2. ทดสอบ command แยก

ก่อนใส่ command ใน skill — ลองรันใน terminal ก่อน:

```bash
# ลองรันใน terminal ก่อน
git log --oneline --since="yesterday"

# ถ้าทำงาน → เอาไปใส่ใน skill
```

### 3. เริ่มจากน้อยไปมาก

```
v1: ทำ step เดียว → ทดสอบ
v2: เพิ่ม step → ทดสอบ
v3: เพิ่ม error handling → ทดสอบ
```

→ [Step 9: แชร์ Skill](09-sharing-skills.md)

---

*"The Oracle Keeps the Human Human"*
