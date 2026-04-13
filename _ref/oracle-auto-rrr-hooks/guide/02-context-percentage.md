# Chapter 2: Context % คืออะไร ทำไมต้องดู

## Context Window คืออะไร

Claude ทำงานใน "context window" — พื้นที่ความจำของ session ปัจจุบัน ทุกอย่างที่คุณพิมพ์ ทุก tool ที่ Claude ใช้ ทุกผลลัพธ์ ล้วนกิน context

```
┌─────────────────────────────────────┐
│          Context Window             │
│  ┌───────────────────────────────┐  │
│  │ System prompt + CLAUDE.md     │  │  ← คงที่
│  │ ข้อความของคุณ                │  │  ← เพิ่มขึ้นเรื่อย ๆ
│  │ Claude ตอบ                   │  │  ← เพิ่มขึ้นเรื่อย ๆ
│  │ Tool results (git, file read) │  │  ← ตัวกินหลัก!
│  │ ...                          │  │
│  └───────────────────────────────┘  │
│  ████████████░░░░░░░  65% used      │
└─────────────────────────────────────┘
```

## ขนาดเท่าไหร่

| Model | Context Window |
|-------|---------------|
| Claude Sonnet 4 | ~200K tokens |
| Claude Opus 4 | ~200K tokens |

~200K tokens ≈ หนังสือ ~150 หน้า

ฟังดูเยอะ แต่ tool results กินเร็วมาก:
- `git diff` ของ PR ใหญ่ = 10-20K tokens
- อ่านไฟล์ยาว = 5-10K tokens
- `git log` ยาว = 3-5K tokens

Session ที่ทำงานจริงจัง 30-60 นาที อาจถึง 80% ได้ง่าย

## เมื่อ Context เต็ม — เกิดอะไรขึ้น

Claude Code มี "auto-compact" — เมื่อ context ใกล้เต็ม มันจะ:

1. **สรุป** ข้อความเก่า → ตัดรายละเอียดออก
2. **ทิ้ง** tool results เก่า
3. **เก็บ** เฉพาะสรุปสั้น ๆ + ข้อความล่าสุด

```
ก่อน compact:          หลัง compact:
├── msg 1 (full)       ├── [summary of msg 1-15]
├── msg 2 (full)       ├── msg 16 (full)
├── ...                ├── msg 17 (full)
├── msg 15 (full)      └── msg 18 (full)
├── msg 16 (full)
├── msg 17 (full)
└── msg 18 (full)
```

## ทำไมนี่เป็นปัญหา

ถ้าคุณทำงานมา 1 ชั่วโมง แล้ว context compact โดยที่ยังไม่ได้:

- **เขียน retrospective** → ความทรงจำของ session หาย
- **สร้าง handoff** → session ถัดไปไม่รู้ว่าทำอะไรค้าง
- **บันทึก lessons learned** → บทเรียนซ้ำรอยเดิม

เหมือนคุณทำงานทั้งวันแต่ไม่ได้ save — แล้วไฟดับ

## วิธีดู Context %

### วิธีที่ 1: StatusLine Hook (แนะนำ)

ติดตั้ง `statusline.sh` จาก repo นี้ → จะเห็น:

```
📊 65% 130k/200k • 45m • Claude Opus 4 on main*
```

### วิธีที่ 2: ถาม Claude

พิมพ์ "context เท่าไหร่แล้ว?" — Claude จะบอกโดยประมาณ

### วิธีที่ 3: สังเกต

ถ้า conversation ยาวมาก (50+ messages) คุณน่าจะใกล้ 80% แล้ว

## Threshold ที่สำคัญ

```
 0-50%   ✅ ปลอดภัย — ทำงานปกติ
50-69%   🟡 เริ่มเยอะ — เตรียมตัว
70-79%   ⚠️ ใกล้ compact — ควร /rrr + /forward เร็ว ๆ
  ~80%   🔄 AUTO-COMPACT — Claude Code ตัดข้อมูลเก่า ณ จุดนี้!
80%+     🚨 วิกฤต — /rrr + /forward เดี๋ยวนี้ ก่อนสาย!
```

### ทำไม 70% ไม่ใช่ 80%?

Claude Code จะ **auto-compact** ที่ประมาณ **~80%** ของ context window ซึ่งหมายความว่า:

- ถ้าตั้งเตือนที่ 80% → **สายเกินไป** compact อาจเริ่มแล้ว ข้อมูลถูกย่อไปแล้ว
- ถ้าตั้งเตือนที่ 70% → มีพื้นที่เหลือ **~10%** (~20K tokens) สำหรับ /rrr + /forward

การรัน /rrr ต้องใช้ context: อ่าน git log, เขียนไฟล์, sync — ประมาณ 5-15K tokens ดังนั้น 70% ให้พื้นที่พอดีสำหรับ wrap up ก่อน compact

Hook `force-rrr-at-80.sh` จะเตือนอัตโนมัติที่ 70% (warning) และ 80% (emergency)

> **ปรับเองได้**: เปิด `hooks/force-rrr-at-80.sh` แก้ `WARN_THRESHOLD=70` และ `FORCE_THRESHOLD=80` เป็นตัวเลขที่ต้องการ

## เทคนิคลด Context ที่ใช้

1. **อ่านเฉพาะที่ต้องการ** — `Read` ระบุ offset/limit แทนอ่านทั้งไฟล์
2. **ใช้ Grep แทน cat** — หาเฉพาะบรรทัดที่สนใจ
3. **สรุปก่อนทำต่อ** — ถ้า task ใหญ่ ให้ /rrr กลางทาง แล้ว /forward
4. **แยก session** — 1 session = 1 task ไม่ใช่ 5 tasks

## ต่อไป

[Chapter 3: force-rrr-at-80 อธิบายทีละบรรทัด →](03-force-rrr-hook.md)
