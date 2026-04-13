# Oracle Hooks Guide — Auto CC Boss

> **Abstract**: คู่มือสร้าง Claude Code hooks ที่ทำงานอัตโนมัติ — เน้นระบบ auto-cc ให้ Oracle หลัก (Boss) รู้ทุกอย่างที่เกิดขึ้นใน Office ผ่าน `maw hey`

> "ถ้า Boss ไม่รู้ — มันไม่ได้เกิดขึ้น"

## Hook คืออะไร?

Hook คือ **สคริปต์ที่รันอัตโนมัติ** เมื่อ Claude Code ทำบางอย่าง — เช่น session จบ, ใช้ tool, หรือ commit code

ลองนึกภาพ:
- Dev Oracle เขียนโค้ดเสร็จ push ขึ้น GitHub → **hook บอก Boss อัตโนมัติ**
- Writer Oracle ส่งข้อความให้ QA → **hook เตือนว่ายังไม่ cc Boss**
- Oracle ไหนก็ตาม context ใกล้เต็ม → **hook สั่งให้หยุดงานก่อน**

ทั้งหมดนี้ **ไม่ต้องจำ ไม่ต้องทำเอง** — hook ทำให้

## คู่มือนี้สำหรับใคร?

- เรียน [oracle-step-by-step](https://github.com/the-oracle-keeps-the-human-human/oracle-step-by-step) จบแล้ว
- ใช้ [maw](https://github.com/the-oracle-keeps-the-human-human/oracle-maw-guide) ส่งข้อความระหว่าง Oracle ได้แล้ว
- อยากทำให้ Office อัตโนมัติมากขึ้น — Oracle cc Boss เอง ไม่ต้องสั่ง

## สิ่งที่จะเรียน

| บท | หัวข้อ | สิ่งที่ได้ |
|----|--------|-----------|
| 1 | [Hook คืออะไร](chapters/01-what-is-hook.md) | เข้าใจระบบ hook ของ Claude Code |
| 2 | [ตั้ง Hook แรก](chapters/02-first-hook.md) | สร้าง hook ง่ายๆ ที่ใช้งานได้จริง |
| 3 | [Auto CC Boss](chapters/03-auto-cc-boss.md) | ระบบ auto-cc ให้ Boss รู้ทุกอย่าง |
| 4 | [Hook ขั้นสูง](chapters/04-advanced-hooks.md) | Debounce, context warning, multi-hook |

## ตัวอย่างพร้อมใช้

| ตัวอย่าง | รายละเอียด |
|----------|-----------|
| [cc-boss-on-stop.sh](examples/cc-boss-on-stop.sh) | Session จบ → cc Boss อัตโนมัติ |
| [remind-cc-after-maw.sh](examples/remind-cc-after-maw.sh) | ส่ง maw hey แล้วลืม cc Boss → เตือน |
| [context-warning.sh](examples/context-warning.sh) | Context 80% → เตือนให้ /rrr |
| [settings.json](examples/settings.json) | ตัวอย่าง settings ที่ผูก hook ทั้งหมด |

แต่ละบทใช้เวลา 10-15 นาที

## Quick Setup

ไม่อยากอ่านทั้งหมด? ดู [SETUP.md](SETUP.md) — copy prompt ไปบอก Claude ติดตั้งให้เลย

## Quick Overview

```
                    ┌─────────────────┐
                    │  Claude Code    │
                    │  (Oracle ทำงาน)  │
                    └────────┬────────┘
                             │
              เกิด event (Stop, PostToolUse, ...)
                             │
                    ┌────────▼────────┐
                    │  settings.json  │ ← ดู hook ที่ลงทะเบียนไว้
                    │  (hook config)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  hook script    │ ← รันสคริปต์อัตโนมัติ
                    │  (.sh / .ts)    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  maw hey boss   │ ← Boss รู้ทุกอย่าง!
                    │  "cc: ..."      │
                    └─────────────────┘
```

## เริ่มเลย

> [บทที่ 1: Hook คืออะไร](chapters/01-what-is-hook.md)

## มีคำถาม?

เปิด [Discussion](../../discussions) ได้เลย

## License

MIT — ใช้, แก้ไข, แชร์ได้ตามสบาย

---

*"Automation is not about replacing the human — it's about freeing the human from remembering."*
