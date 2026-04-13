# บทที่ 2: โครงสร้างไฟล์ของ Oracle Office

> **Abstract**: Every Oracle lives in a Git repo with a specific file structure. This chapter maps each file — CLAUDE.md, .claude/, .mcp.json, and the psi vault — explaining what it does and why it matters.

## ทุก Oracle อยู่ใน Git Repo

Oracle แต่ละตัวมี repo ของตัวเอง โครงสร้างหน้าตาแบบนี้:

```
my-oracle/
├── CLAUDE.md              ← สมอง + ตัวตน + กฎ
├── CLAUDE_safety.md       ← กฎความปลอดภัย (optional)
├── CLAUDE_workflows.md    ← วิธีทำงาน (optional)
├── .claude/
│   └── settings.json      ← permissions + hooks
├── .mcp.json              ← MCP servers ที่ Oracle ใช้
└── ψ/                     ← สมองภายนอก (vault)
    ├── inbox/             ← ข้อความที่ได้รับ
    ├── memory/
    │   ├── learnings/     ← สิ่งที่เรียนรู้
    │   └── retrospectives/← session retros
    ├── writing/           ← drafts, documents
    ├── lab/               ← ทดลอง
    └── active/            ← งานที่กำลังทำ
```

## แต่ละไฟล์ทำอะไร?

### CLAUDE.md — หัวใจของ Oracle

| ส่วน | หน้าที่ |
|------|--------|
| Identity | ชื่อ, บทบาท, ปรัชญา |
| Scope | งานที่รับผิดชอบ |
| Rules (THE LAW) | กฎที่ต้องทำตาม |
| Team | ทีมที่ทำงานด้วย + วิธีติดต่อ |
| Golden Rules | กฎที่ห้ามละเมิดเด็ดขาด |

**CLAUDE.md คือ DNA ของ Oracle** — ทุกครั้งที่ Oracle wake ขึ้นมา จะอ่านไฟล์นี้ก่อน

ตัวอย่าง Identity section:

```markdown
## Identity

**I am**: Dev — the builder
**Purpose**: เขียนโค้ด, debug, deploy
**Team**: BoB (Boss), QA (ตรวจสอบ), Writer (เอกสาร)
```

### .claude/settings.json — Permissions & Hooks

```json
{
  "permissions": {
    "allow": [
      "Bash(git *)",
      "Bash(npm *)",
      "Bash(bun *)"
    ],
    "deny": [
      "Bash(rm -rf /)"
    ]
  }
}
```

| Key | หน้าที่ |
|-----|--------|
| permissions.allow | คำสั่งที่ Oracle ใช้ได้โดยไม่ต้องถาม |
| permissions.deny | คำสั่งที่ห้ามใช้เด็ดขาด |

### .mcp.json — MCP Servers

MCP (Model Context Protocol) คือช่องทางที่ Oracle ใช้เชื่อมกับเครื่องมือภายนอก

```json
{
  "mcpServers": {
    "oracle-v2": {
      "command": "npx",
      "args": ["oracle-v2-mcp"],
      "env": { "ORACLE_NAME": "dev" }
    }
  }
}
```

| Server | หน้าที่ |
|--------|--------|
| oracle-v2 | Memory (arra vault) — จำข้อมูลข้าม session |
| filesystem | อ่าน/เขียนไฟล์ |
| github | จัดการ GitHub issues, PRs |

### ψ/ (psi vault) — สมองภายนอก

`ψ/` คือ directory ที่เก็บ **ทุกอย่างที่ Oracle จำ**

```
ψ/
├── inbox/              ← ข้อความจาก Oracle อื่น
│   └── handoff/        ← handoff จาก session ก่อน
├── memory/
│   ├── learnings/      ← "วันนี้เรียนรู้ว่า X"
│   └── retrospectives/ ← "session นี้ทำอะไรไป"
├── writing/            ← documents, guides, drafts
├── lab/                ← experiments
└── active/             ← งานที่กำลังทำอยู่ตอนนี้
```

**ทำไม psi vault สำคัญ?**

Oracle มี memory แค่ใน session — พอ session จบ ลืมหมด
`ψ/` คือ **external brain** — เขียนลงไปแล้วอ่านกลับมาได้ใน session ถัดไป

## โครงสร้าง Office ทั้งหมด

ถ้ามี Oracle 3 ตัว — Boss, Dev, QA — จะมี 3 repos:

```
~/oracles/
├── boss-oracle/         ← Boss Oracle repo
│   ├── CLAUDE.md
│   ├── .claude/settings.json
│   ├── .mcp.json
│   └── ψ/
├── dev-oracle/          ← Dev Oracle repo
│   ├── CLAUDE.md
│   ├── .claude/settings.json
│   ├── .mcp.json
│   └── ψ/
└── qa-oracle/           ← QA Oracle repo
    ├── CLAUDE.md
    ├── .claude/settings.json
    ├── .mcp.json
    └── ψ/
```

**แต่ละ repo เป็นอิสระจากกัน** — Oracle คุยกันผ่าน maw, ไม่ใช่ผ่าน filesystem

## Checklist

ก่อนไปบทถัดไป ตรวจสอบว่าเข้าใจ:

- [ ] CLAUDE.md = DNA, identity, กฎ
- [ ] .claude/settings.json = permissions
- [ ] .mcp.json = เครื่องมือภายนอก
- [ ] ψ/ = สมองภายนอก ข้าม session

---

> [บทที่ 3: กำหนด Roles](03-roles.md)
