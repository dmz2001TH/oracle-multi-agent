# Oracle Auto /rrr + /forward Hooks

> ไม่ลืม wrap up session อีกต่อไป — Claude Code hooks ทำให้อัตโนมัติ

## ปัญหาที่แก้

เคยมีไหม?
- Session ยาว ๆ แล้ว context ล้น — ข้อมูลหาย ไม่ได้ /rrr
- ลืม /forward ก่อนจบ session — session ถัดไปไม่รู้ว่าทำอะไรค้าง
- Context เต็ม 90%+ แล้ว Claude compact อัตโนมัติ — retrospective หาย

**Hook ชุดนี้แก้ทุกปัญหาข้างต้น** โดยใช้ Claude Code Hooks (built-in feature)

## Hooks ทั้งหมด

| Hook | Event | ทำอะไร |
|------|-------|--------|
| `force-rrr-at-80.sh` | PostToolUse | เตือนที่ 70%, บังคับที่ 80% ให้รัน /rrr + /forward |
| `auto-forward-on-stop.sh` | Stop | เตือนให้ /forward ก่อนจบ session |
| `statusline.sh` | StatusLine | แสดง context % แบบ real-time (hook อื่นอ่านค่าจากนี้) |

## Quick Start (5 นาที)

```bash
# 1. Clone
git clone https://github.com/the-oracle-keeps-the-human-human/oracle-auto-rrr-hooks.git
cd oracle-auto-rrr-hooks

# 2. รันสคริปต์ติดตั้ง
./install.sh

# 3. เปิด Claude Code — hooks ทำงานทันที!
claude
```

## สิ่งที่ต้องมีก่อน

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (CLI)
- `jq` — `sudo apt install jq` หรือ `brew install jq`
- `python3` — มาพร้อม macOS/Linux ส่วนใหญ่

## โครงสร้าง Repo

```
oracle-auto-rrr-hooks/
├── README.md                    # คุณอยู่ที่นี่
├── install.sh                   # สคริปต์ติดตั้งอัตโนมัติ
├── hooks/
│   ├── force-rrr-at-80.sh      # PostToolUse — เตือน/บังคับ rrr
│   ├── auto-forward-on-stop.sh # Stop — เตือน forward
│   └── statusline.sh           # StatusLine — แสดง context %
├── guide/
│   ├── 01-how-hooks-work.md    # Claude Code Hooks ทำงานยังไง
│   ├── 02-context-percentage.md # Context % คืออะไร ทำไมต้องดู
│   ├── 03-force-rrr-hook.md    # อธิบาย force-rrr-at-80 ทีละบรรทัด
│   ├── 04-stop-hook.md         # อธิบาย auto-forward-on-stop ทีละบรรทัด
│   ├── 05-statusline-hook.md   # อธิบาย statusline ทีละบรรทัด
│   ├── 06-customization.md     # ปรับแต่งเอง — เปลี่ยน threshold, ข้อความ
│   └── 07-troubleshooting.md   # แก้ปัญหาที่พบบ่อย
├── examples/
│   └── settings.json           # ตัวอย่าง settings.json ที่ใช้จริง
└── CLAUDE.md                   # Oracle identity
```

## วิธีทำงาน (สรุป)

```
┌─────────────────────────────────────────────────────┐
│                  Claude Code Session                │
│                                                     │
│  StatusLine hook → เขียน context % ลง JSON file     │
│                     ↓                               │
│  ทุก tool use → force-rrr-at-80.sh อ่าน JSON       │
│                     ↓                               │
│  70%+ → ⚠️ เตือน "รัน /rrr + /forward เร็ว ๆ"      │
│  80%+ → 🚨 บังคับ "หยุดทุกอย่าง! /rrr เดี๋ยวนี้"    │
│                                                     │
│  ⚡ ทำไม 70% ไม่ใช่ 80%?                             │
│  → Claude Code auto-compact ที่ ~80%                │
│  → ถ้ารอถึง 80% อาจสายเกินไป ข้อมูลถูกตัดแล้ว      │
│  → เราจึงเตือนที่ 70% ให้มีเวลาเตรียมตัว            │
│                                                     │
│  Session จบ → auto-forward-on-stop.sh เตือน         │
│              "ลืม /forward หรือเปล่า?"              │
└─────────────────────────────────────────────────────┘
```

## ทำไมต้องทำ — และทำไม 70% ไม่ใช่ 80%

Claude Code มี context window จำกัด (~200K tokens) เมื่อใช้ไปประมาณ **~80%** Claude Code จะ **auto-compact** — สรุปข้อความเก่าแล้วตัดรายละเอียดทิ้ง

ถ้าคุณยังไม่ได้:

1. **`/rrr`** — เขียน retrospective (บันทึกสิ่งที่ทำ, บทเรียน, diary)
2. **`/forward`** — สร้าง handoff (บอก session ถัดไปว่าต้องทำอะไรต่อ)

...ข้อมูลเหล่านั้นจะถูก compact ทิ้ง — retrospective จะไม่สมบูรณ์

**เราจึงตั้ง warning ที่ 70%** เพื่อให้มีเวลา ~10% ของ context (ประมาณ 20K tokens) สำหรับ /rrr + /forward ก่อนที่ auto-compact จะทำงาน

> **อยากเปลี่ยน threshold?** เปิด `hooks/force-rrr-at-80.sh` แก้ `WARN_THRESHOLD` และ `FORCE_THRESHOLD` ที่บรรทัดบนสุดของไฟล์ ดูรายละเอียดใน [guide/06-customization.md](guide/06-customization.md)

## License

MIT — ใช้, แก้ไข, แชร์ได้ตามสบาย
