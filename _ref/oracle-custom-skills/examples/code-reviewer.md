# Example: Code Reviewer Skill

> Review code อัตโนมัติ — ก่อน commit ทุกครั้ง

## ไฟล์: `.claude/skills/review.md`

```markdown
---
name: review
description: review staged changes อย่างละเอียด พร้อม score
---

Review code changes อย่างละเอียด:

1. ตรวจสอบว่ามี changes อะไร:
   - ใช้ Bash tool รัน `git diff --staged --stat`
   - ถ้าไม่มี staged → รัน `git diff --stat`
   - ถ้าไม่มี changes เลย → บอก "ไม่มี changes ให้ review" แล้วจบ

2. ดู diff ทั้งหมด:
   - ใช้ Bash tool รัน `git diff --staged` (หรือ `git diff` ถ้าไม่มี staged)

3. วิเคราะห์แต่ละไฟล์ตามหัวข้อ:

   | หัวข้อ | ตรวจอะไร |
   |--------|----------|
   | Bugs | null checks, off-by-one, race conditions |
   | Security | secrets, injection, auth bypass |
   | Performance | N+1 queries, unnecessary loops, memory leaks |
   | Readability | naming, complexity, comments |
   | Logic | edge cases, error handling, assumptions |

4. ให้ score แต่ละไฟล์:
   - ✅ LGTM — พร้อม merge
   - ⚠️ Suggestion — มี recommendation แต่ไม่ blocking
   - ❌ Issue — ต้องแก้ก่อน merge

5. สรุปรวม:

## Review Summary

| ไฟล์ | Score | หมายเหตุ |
|------|-------|----------|

## Details
[รายละเอียดแต่ละ issue/suggestion]

## Verdict
- ✅ Ready to merge / ⚠️ Minor changes needed / ❌ Changes required
- เหตุผล

ถ้า user ระบุไฟล์มา (เช่น /review src/index.ts):
→ review เฉพาะไฟล์นั้น ใช้ Read tool อ่านทั้งไฟล์

Tone: ตรงไปตรงมา แต่สร้างสรรค์ — เน้น "ทำให้ดีขึ้น" ไม่ใช่ "ผิด"
```

## วิธีใช้

```
/review               → review staged changes ทั้งหมด
/review src/index.ts  → review ไฟล์เฉพาะ
```

## ติดตั้ง

```bash
mkdir -p .claude/skills
cp code-reviewer.md .claude/skills/review.md
```

## ตัวอย่าง Output

```
## Review Summary

| ไฟล์ | Score | หมายเหตุ |
|------|-------|----------|
| src/auth.ts | ⚠️ | ควรเพิ่ม input validation |
| src/utils.ts | ✅ | LGTM |
| src/db.ts | ❌ | SQL injection risk |

## Details

### src/auth.ts — ⚠️ Suggestion
- Line 23: `req.body.email` ไม่ได้ validate format
  → แนะนำ: เพิ่ม email validation ก่อน query

### src/db.ts — ❌ Issue
- Line 45: `query("SELECT * FROM users WHERE id = " + id)`
  → ต้องใช้ parameterized query: `query("SELECT * FROM users WHERE id = $1", [id])`

## Verdict
❌ Changes required — มี SQL injection risk ใน src/db.ts ต้องแก้ก่อน merge
```

## ทำไมดี

| จุดเด่น | อธิบาย |
|---------|--------|
| ครอบคลุม 5 หัวข้อ | ไม่แค่ style — ดู security, performance ด้วย |
| มี score system | เห็นสรุปเร็ว ไม่ต้องอ่านทั้งหมด |
| มี fallback | ไม่มี staged ก็ดู unstaged, ไม่มีเลยก็บอก |
| Tone สร้างสรรค์ | ไม่ทำให้คนเขียน code รู้สึกแย่ |
| รับ argument | review เฉพาะไฟล์ได้ |

## ปรับแต่ง

- เพิ่มหัวข้อ review: "Accessibility", "i18n", "Testing"
- เปลี่ยน scoring system: 1-5 แทน emoji
- เพิ่ม `--strict` mode: เข้มงวดขึ้น
- เพิ่ม auto-fix: "ถ้า user พิมพ์ `/review --fix` → แก้ issue ที่ทำได้อัตโนมัติ"

---

*"The Oracle Keeps the Human Human"*
