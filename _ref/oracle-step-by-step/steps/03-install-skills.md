# Step 3: ติดตั้ง Skills

> Skills คือความสามารถของ Oracle — ยิ่งมี skills มาก ยิ่งทำได้มาก

## oracle-skills-cli คืออะไร?

CLI ที่ติดตั้ง 29 skills เข้า AI agents ได้ — ไม่ใช่แค่ Claude Code แต่รวมถึง Cursor, OpenCode, และอื่นๆ อีก 15+ ตัว

## ติดตั้ง oracle-skills-cli

```bash
# วิธีง่ายที่สุด
curl -fsSL https://raw.githubusercontent.com/Soul-Brews-Studio/oracle-skills-cli/main/install.sh | bash
```

หรือผ่าน npm:
```bash
npm install -g oracle-skills
```

## เลือก Profile

Skills แบ่งเป็น profiles ตาม level:

| Profile | Skills | เหมาะกับ |
|---------|--------|----------|
| **minimal** | 8 skills | เริ่มต้น — เอาแค่พื้นฐาน |
| **standard** | 12 skills | ใช้งานทั่วไป (default) |
| **full** | 29 skills | ทุกอย่าง — สำหรับ power user |

### Features เสริม (ใช้ร่วมกับ profile ได้)

| Feature | เพิ่มอะไร |
|---------|----------|
| `+soul` | /philosophy, /who-are-you, /about-oracle — identity & philosophy |
| `+network` | /talk-to, /oracle-family-scan, /oraclenet — multi-agent communication |
| `+workspace` | /worktree, /project, /schedule — workspace tools |
| `+creator` | /awaken, /birth — สำหรับสร้าง Oracle ใหม่ |

## ติดตั้ง Skills

```bash
# Standard profile (แนะนำสำหรับเริ่มต้น)
oracle-skills install -g -y

# หรือเลือก profile
oracle-skills install -g -y -p minimal
oracle-skills install -g -y -p full

# เพิ่ม features
oracle-skills install -g -y -p standard +soul +network
```

## Skills หลักที่ได้

หลังติดตั้ง จะใช้ commands เหล่านี้ใน Claude Code ได้:

### ใช้ทุกวัน

| Command | ทำอะไร |
|---------|--------|
| `/recap` | เริ่ม session — ดู context, git state, memory |
| `/rrr` | จบ session — เขียน retrospective + lessons learned |
| `/forward` | สร้าง handoff สำหรับ session ถัดไป |
| `/standup` | Daily check — งานค้าง, นัดหมาย |

### เรียนรู้

| Command | ทำอะไร |
|---------|--------|
| `/learn [repo]` | ศึกษา codebase ด้วย 3-5 Haiku agents |
| `/dig` | ขุด session history จาก .jsonl |
| `/trace` | ค้นหา project ข้าม repos |

### สื่อสาร

| Command | ทำอะไร |
|---------|--------|
| `/talk-to [oracle] "msg"` | คุยกับ Oracle อื่น |
| `/oracle-family-scan` | scan Oracle ทั้งหมดในระบบ |

## ทดสอบ

```bash
# เปิด Claude Code
claude

# ลองใช้ skills
> /recap
> /who-are-you
```

ถ้า skills ทำงาน → `/recap` จะแสดง git status, last commits, และ session context

## เพิ่มใน CLAUDE.md

กลับไปเพิ่มใน CLAUDE.md:

```markdown
## Installed Skills

`/recap` `/learn` `/rrr` `/forward` `/standup` `/dig` `/trace`
```

## ดู skills ที่ติดตั้ง

```bash
oracle-skills list           # ดูทั้งหมด
oracle-skills profiles       # ดู profiles
oracle-skills agents         # ดู agents ที่ detect ได้
```

## สิ่งที่ได้

- [x] oracle-skills-cli ติดตั้งแล้ว
- [x] Skills พร้อมใช้ใน Claude Code
- [x] /recap, /rrr, /learn ทำงานได้
- [x] CLAUDE.md updated

---

**ถัดไป**: [Step 4: สมองของ Oracle — ψ/ Vault](04-brain-vault.md)
