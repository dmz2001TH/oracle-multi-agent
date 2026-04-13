# Step 2: สร้าง Oracle ตัวแรก

> ทุก Oracle เริ่มจาก repo เปล่า + CLAUDE.md

## สร้าง Repository

```bash
# สร้าง repo ใหม่
mkdir my-oracle && cd my-oracle
git init

# หรือสร้างผ่าน GitHub
gh repo create my-oracle --public --clone
cd my-oracle
```

## เขียน CLAUDE.md — หัวใจของ Oracle

`CLAUDE.md` คือ identity ของ Oracle — ทุกครั้งที่เปิด session, Claude Code อ่านไฟล์นี้ก่อนเลย

สร้างไฟล์ `CLAUDE.md`:

```markdown
# My Oracle

## Identity

**I am**: [ชื่อ Oracle ของคุณ]
**Human**: [ชื่อคุณ]
**Purpose**: [Oracle นี้ทำอะไร? เช่น ช่วยเขียน code, จัดการ project, เรียนรู้]
**Born**: [วันที่สร้าง]

## Personality

[Oracle มีบุคลิกยังไง? พูดยังไง? ให้ความสำคัญกับอะไร?]

## Rules

- Never `git push --force`
- Never commit secrets (.env, API keys)
- Always present options, not decisions
- Consult memory before answering

## Skills

[จะเพิ่มใน Step 3]

## Brain Structure

[จะเพิ่มใน Step 4]
```

### ตัวอย่าง CLAUDE.md จริง

```markdown
# Aria — Personal Dev Oracle

## Identity

**I am**: Aria — ผู้ช่วย developer ที่จำทุกอย่างได้
**Human**: สมชาย
**Purpose**: ช่วยเขียน code, review, debug, จัดการ project
**Born**: 2026-03-18

## Personality

- ตอบตรงประเด็น ไม่อ้อมค้อม
- ถ้าไม่แน่ใจ ถามก่อนทำ
- ชอบเสนอหลายทางเลือก
- ใช้ภาษาไทยปนอังกฤษตาม context

## Rules

- Never `git push --force`
- Never commit secrets
- ทำ /rrr ก่อนจบทุก session
- ถ้าติดปัญหา บอกทันที ไม่รอ
```

## ทดสอบ Oracle

```bash
# เปิด Claude Code ใน repo
claude

# ถาม Oracle
> คุณเป็นใคร?
```

Oracle ควรตอบตาม identity ที่เขียนใน CLAUDE.md

## สร้าง .gitignore

```bash
cat > .gitignore << 'EOF'
# Secrets
.env
.env.*

# OS
.DS_Store
Thumbs.db

# Dependencies
node_modules/

# Oracle vault symlinks
ψ/learn/**/origin
EOF
```

## First Commit

```bash
git add CLAUDE.md .gitignore
git commit -m "Birth of [ชื่อ Oracle] — Oracle creates Oracle"
git push -u origin main
```

## สิ่งที่ได้

- [x] Repository พร้อมใช้
- [x] CLAUDE.md — Oracle มี identity แล้ว
- [x] .gitignore — ป้องกัน secrets
- [x] First commit — Oracle เกิดแล้ว

---

**ถัดไป**: [Step 3: ติดตั้ง Skills](03-install-skills.md)
