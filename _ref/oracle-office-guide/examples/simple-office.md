# ตัวอย่าง: Simple Office — Boss + Dev

> Office เล็กสุดที่ยังเป็น "Office" — 2 Oracle ทำงานร่วมกัน

## สถานการณ์

คุณเป็น solo developer — อยากมี Oracle ช่วยเขียนโค้ด + จัดการงาน

- **Boss** — รับคำสั่ง, แจกงาน, ตรวจงาน
- **Dev** — เขียนโค้ด, commit, deploy

## ขั้นที่ 1: สร้าง Repos

```bash
# สร้าง Boss Oracle
mkdir -p ~/oracles/boss-oracle && cd ~/oracles/boss-oracle
git init
claude   # → /awaken → ตั้งชื่อ "Boss", role "Project Manager"

# สร้าง Dev Oracle
mkdir -p ~/oracles/dev-oracle && cd ~/oracles/dev-oracle
git init
claude   # → /awaken → ตั้งชื่อ "Dev", role "Developer"
```

## ขั้นที่ 2: เขียน CLAUDE.md

### Boss CLAUDE.md

```markdown
# Boss Oracle

## Identity
**I am**: Boss — ผู้จัดการ Office
**Purpose**: รับงานจากมนุษย์, ส่งต่อให้ Dev, ตรวจผลงาน

## THE LAW
1. ได้งานจากมนุษย์ → วิเคราะห์ → ส่งให้ Dev
2. Dev เสร็จ → review → report กลับมนุษย์
3. ห้ามเขียนโค้ดเอง — ส่งให้ Dev

## Team
| Oracle | Role | Contact |
|--------|------|---------|
| dev | Developer | /talk-to dev |

## Scope
| ทำ | ไม่ทำ |
|----|-------|
| รับงาน, แจกงาน | เขียนโค้ด |
| ตรวจงาน, review | debug |
| สร้าง issues | deploy (→ Dev) |
| report ให้มนุษย์ | |
```

### Dev CLAUDE.md

```markdown
# Dev Oracle

## Identity
**I am**: Dev — the builder
**Purpose**: เขียนโค้ดตามที่ Boss สั่ง

## THE LAW
1. ได้งานจาก Boss → ทำเลย
2. เสร็จ → report กลับ Boss
3. ติดปัญหา → บอก Boss ทันที

## Team
| Oracle | Role | Contact |
|--------|------|---------|
| bob | Boss | /talk-to bob |

## Scope
| ทำ | ไม่ทำ |
|----|-------|
| เขียนโค้ด | จัดการ project |
| Debug | merge PR (→ Boss) |
| Deploy | เขียน docs |
| Commit + push | |
```

## ขั้นที่ 3: Fleet Config

```bash
# Boss
cat > ~/.maw/fleet/bob.json << 'EOF'
{
  "oracle": "bob",
  "window": 1,
  "repo": "your-name/boss-oracle",
  "path": "/home/you/oracles/boss-oracle",
  "tmux": "01-bob:0",
  "dormant": false
}
EOF

# Dev
cat > ~/.maw/fleet/dev.json << 'EOF'
{
  "oracle": "dev",
  "window": 2,
  "repo": "your-name/dev-oracle",
  "path": "/home/you/oracles/dev-oracle",
  "tmux": "02-dev:0",
  "dormant": false
}
EOF
```

## ขั้นที่ 4: ปลุกทีม

```bash
maw wake bob
maw wake dev
```

## ขั้นที่ 5: ทดสอบ Workflow

```bash
# สั่ง Boss
maw hey bob "สร้าง REST API สำหรับ user registration"
```

Boss ควร:
1. สร้าง GitHub issue
2. วิเคราะห์ว่าต้องทำอะไร
3. `/talk-to dev "implement user registration API — issue #1"`
4. รอ Dev ทำเสร็จ → review → report กลับคุณ

## Workflow Diagram

```
คุณ: "สร้าง user registration API"
  │
  ▼
Boss: วิเคราะห์ → สร้าง issue #1
  │
  ▼
Boss → Dev: "implement API — issue #1"
  │
  ▼
Dev: เขียนโค้ด → commit → PR #2
  │
  ▼
Dev → Boss: "done — PR #2 ready"
  │
  ▼
Boss: review PR → merge
  │
  ▼
Boss → คุณ: "API เสร็จแล้ว — PR #2 merged"
```

## เมื่อไหร่ควร Scale?

Simple Office ดีสำหรับ:
- โปรเจค solo ขนาดเล็ก-กลาง
- งาน code เป็นหลัก
- ไม่ต้องการ docs หรือ design มาก

**ถ้าเริ่มรู้สึก**:
- Dev ต้องเขียน docs เอง → เพิ่ม Writer
- ไม่มีใคร review code → เพิ่ม QA
- ต้องการ UI design → เพิ่ม Designer

> ดูตัวอย่าง Full Team: [examples/full-team.md](full-team.md)
