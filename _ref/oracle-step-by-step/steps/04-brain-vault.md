# Step 4: สมองของ Oracle — ψ/ Vault

> ψ (psi) คือสมองของ Oracle — ที่เก็บทุกอย่างที่เรียนรู้

## ψ/ คืออะไร?

ψ/ (อ่านว่า "ไซ") คือ directory ที่เก็บความทรงจำทั้งหมดของ Oracle:
- สิ่งที่เรียนรู้ (learnings)
- บันทึก session (retrospectives)
- งานที่กำลังทำ (active)
- สิ่งที่กำลังเขียน (writing)
- การทดลอง (lab)

## สร้าง ψ/ Vault

```bash
# สร้าง structure ทั้งหมด
mkdir -p ψ/{inbox,memory/{learnings,retrospectives,resonance},learn,writing,lab,active,archive,outbox}
```

### โครงสร้าง

```
ψ/
├── inbox/          ← สิ่งที่เข้ามา (tasks, messages, handoffs)
├── memory/
│   ├── learnings/      ← สิ่งที่เรียนรู้จากทุก session
│   ├── retrospectives/ ← บันทึก /rrr
│   └── resonance/      ← ปรัชญา, ค่านิยม, identity ลึกๆ
├── learn/          ← ผลจาก /learn (codebase analysis)
├── writing/        ← drafts, guides, tutorials
├── lab/            ← experiments
├── active/         ← งานที่กำลังทำอยู่
├── archive/        ← งานเสร็จแล้ว
└── outbox/         ← สิ่งที่จะส่งออก
```

## สร้าง .gitignore สำหรับ ψ/

```bash
cat > ψ/.gitignore << 'EOF'
# Ignore origin symlinks from /learn
**/origin

# Ignore data files
data/
EOF
```

## Resonance Files — ปรัชญาของ Oracle

สร้างไฟล์ resonance เพื่อให้ Oracle มีแก่นลึก:

```bash
cat > ψ/memory/resonance/oracle.md << 'EOF'
# Oracle Philosophy

## Core Beliefs

1. ความรู้ไม่มีวันหาย — ทุกอย่างถูกเก็บ
2. ทุก session คือโอกาสเรียนรู้
3. ถามคำถามที่ดี สำคัญกว่าตอบเร็ว
4. Pattern สำคัญกว่า intention
5. สมองภายนอก ไม่ใช่ทาส

## My Purpose

[เขียนเองว่า Oracle ของคุณมีจุดประสงค์อะไร]
EOF
```

## เพิ่มใน CLAUDE.md

```markdown
## Brain Structure

\`\`\`
ψ/ → inbox/ | memory/ (learnings, retros) | writing/ | lab/ | active/
\`\`\`
```

## ψ/ กับ Git

ψ/ อยู่ใน repo — commit ได้เลย (ยกเว้น origin symlinks):

```bash
git add ψ/
git commit -m "feat: initialize ψ/ brain vault"
```

## ดูสมองของ Oracle

```bash
# ดู files ล่าสุดใน ψ/
find ψ/ -name '*.md' | xargs ls -t | head -10

# ดู learnings
ls ψ/memory/learnings/

# ดู retrospectives
ls ψ/memory/retrospectives/
```

## สิ่งที่ได้

- [x] ψ/ vault structure พร้อม
- [x] Resonance file — Oracle มีปรัชญา
- [x] .gitignore ถูกต้อง
- [x] CLAUDE.md updated

---

**ถัดไป**: [Step 5: ความทรงจำถาวร — oracle-v2](05-oracle-memory.md)
