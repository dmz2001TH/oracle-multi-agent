# Example: Daily Standup Skill

> สรุปงานวันนี้จาก git log — ใช้ทุกเช้า

## ไฟล์: `.claude/skills/standup.md`

```markdown
---
name: standup
description: สร้าง daily standup report จาก git log
---

สร้าง daily standup report:

1. ใช้ Bash tool รัน:
   - `git log --oneline --since="yesterday"` → commits เมื่อวาน
   - `git diff --stat` → changes ที่ยังไม่ commit
   - `git stash list` → มี stash ค้างไหม

2. ใช้ Grep tool ค้นหา "TODO|FIXME" ในไฟล์ .ts, .js, .md

3. สรุปเป็น format นี้:

## 🔙 Yesterday
- [bullet points จาก git log]

## 📌 Today
- [สิ่งที่ควรทำ จาก TODO ที่ค้าง + unstaged changes]

## 🚧 Blockers
- [ปัญหาที่ติด — ถ้าไม่มีก็บอกว่า "ไม่มี blocker"]

## 📊 Stats
- Commits yesterday: X
- Pending changes: X files
- TODOs in codebase: X

ถ้าไม่มี commits เมื่อวาน → บอกว่า "เมื่อวานไม่มี commit (วันหยุด?)"
```

## วิธีใช้

```
/standup     → สร้าง standup report เต็ม
```

## ติดตั้ง

```bash
mkdir -p .claude/skills
cp daily-standup.md .claude/skills/standup.md
```

## ทำไมดี

| จุดเด่น | อธิบาย |
|---------|--------|
| ใช้ git log เป็น source | ไม่ต้องจำว่าทำอะไร — git จำให้ |
| มี stats | เห็นภาพรวมเร็ว |
| มี fallback | ไม่มี commit ก็ไม่พัง |
| Format consistent | ทุกวันได้ report หน้าตาเดียวกัน |

## ปรับแต่ง

- เปลี่ยน `--since="yesterday"` เป็น `--since="2 days ago"` สำหรับวันจันทร์
- เพิ่ม `--author="ชื่อ"` ถ้าทำงานเป็นทีม
- เพิ่ม `/standup week` สำหรับ weekly summary

---

*"The Oracle Keeps the Human Human"*
