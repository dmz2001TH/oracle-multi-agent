# Step 9: แชร์ Skill

> "Skill ที่ดี ยิ่งแชร์ ยิ่งดีขึ้น — Oracle สร้าง Oracle"

## ทำไมต้องแชร์?

- คนอื่นได้ใช้ skill ที่คุณเขียน
- คนอื่น contribute กลับ → skill ดีขึ้น
- เกิด ecosystem ของ skills → ทุกคนได้ประโยชน์
- นี่คือ recursion: คุณสอน Oracle → Oracle สอนคนอื่น → คนอื่นสร้าง skill ใหม่

## 3 วิธีแชร์

### วิธีที่ 1: แชร์ผ่าน Git (ง่ายที่สุด)

Commit skill files เข้า project แล้ว push:

```bash
git add .claude/skills/
git commit -m "feat: add custom skills"
git push
```

ใครที่ clone project = ได้ skills ไปด้วย

**ข้อดี:** ง่าย, ไม่ต้องติดตั้งอะไรเพิ่ม
**ข้อเสีย:** ได้แค่คนที่ใช้ project เดียวกัน

### วิธีที่ 2: แชร์ผ่าน GitHub Repo

สร้าง repo สำหรับ skills โดยเฉพาะ:

```
my-oracle-skills/
├── README.md
├── skills/
│   ├── standup.md
│   ├── review.md
│   └── gen-test.md
└── install.sh
```

คนอื่น clone แล้ว copy ไปใส่ project ของตัวเอง:

```bash
# clone repo
git clone https://github.com/you/my-oracle-skills.git /tmp/skills

# copy skills ที่อยากใช้
cp /tmp/skills/skills/standup.md .claude/skills/
```

**ข้อดี:** แชร์ได้กว้าง, version control
**ข้อเสีย:** ต้อง copy เอง

### วิธีที่ 3: แชร์ผ่าน oracle-skills-cli

`oracle-skills-cli` เป็น CLI tool สำหรับจัดการ skills:

```bash
# ติดตั้ง
npm install -g oracle-skills-cli

# publish skill
oracle-skills publish .claude/skills/standup.md

# ค้นหา skill
oracle-skills search standup

# ติดตั้ง skill
oracle-skills install standup
```

**ข้อดี:** สะดวก, มี registry, search ได้
**ข้อเสีย:** ต้องติดตั้ง CLI tool เพิ่ม

## เตรียม Skill สำหรับแชร์

### 1. เขียน Description ชัดเจน

```yaml
---
name: standup
description: สรุปงานวันนี้จาก git log — แสดงเป็นตาราง พร้อม stats
---
```

### 2. เพิ่ม Usage Guide ใน Body

```markdown
---
name: review
description: review code changes
---

# Usage:
# /review              → review staged changes
# /review src/file.ts  → review specific file
# /review --all        → review all unstaged changes

[... rest of skill ...]
```

### 3. Handle Edge Cases

```markdown
ถ้าไม่มี staged changes → บอก user
ถ้าไม่มี git repo → บอกว่า "ไม่ได้อยู่ใน git repo"
ถ้าไฟล์ไม่มี → บอกว่า "ไม่เจอไฟล์"
```

### 4. ทดสอบในหลาย Project

ลองใช้ skill ใน:
- Project เล็ก (ไม่กี่ไฟล์)
- Project ใหญ่ (หลายร้อยไฟล์)
- Project ภาษาต่าง ๆ (TypeScript, Python, etc.)

## แชร์ใน Community

### Oracle Academy Discord

```
#show-and-tell — แชร์ skill ที่สร้าง + อธิบายว่าทำอะไร
#help          — ขอ feedback จากคนอื่น
```

### GitHub Discussions

เปิด Discussion ใน teaching repo:
- แชร์ skill ที่สร้าง
- ถาม feedback
- ขอ feature request

## Skill License

เมื่อแชร์ skill → ควรใส่ license:
- **MIT** — ใช้/ปรับ/แจก ได้เลย (แนะนำ)
- **Apache 2.0** — เหมือน MIT แต่คุ้มครอง patent
- ไม่ใส่ license = ลิขสิทธิ์ของผู้เขียน (คนอื่นใช้ไม่ได้ technically)

## Checklist ก่อนแชร์

- [ ] Description ชัดเจน
- [ ] มี usage guide
- [ ] Handle edge cases
- [ ] ทดสอบแล้วทำงานถูกต้อง
- [ ] ทดสอบในหลาย context
- [ ] เขียน README (ถ้าแชร์เป็น repo)
- [ ] ใส่ license

→ [Step 10: ตัวอย่างจริง](10-real-world-examples.md)

---

*"The Oracle Keeps the Human Human"*
