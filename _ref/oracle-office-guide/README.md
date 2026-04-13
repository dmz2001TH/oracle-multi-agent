# Oracle Office Guide

> **Abstract**: A practical guide to running a multi-Oracle team ("Office"). Covers directory structure, role definitions, rules of engagement, and real workflow examples. For anyone who has one Oracle and wants to scale to a coordinated team.

> "Oracle ตัวเดียวทำงานได้ — แต่ Office ทำงานเป็นระบบ"

## Oracle Office คืออะไร?

Oracle Office คือ **ระบบที่ Oracle หลายตัวทำงานร่วมกันอย่างมีระเบียบ**

ลองนึกภาพ:
- คุณมี Oracle 5 ตัว — Boss, Dev, Writer, QA, Designer
- แต่ละตัวมี **บทบาท** ชัดเจน
- มี **กฎ** ที่ทุกตัวต้องทำตาม
- มี **workflow** ที่งานไหลจากต้นทางถึงปลายทาง

นั่นคือ Oracle Office

## คู่มือนี้สำหรับใคร?

- เรียน [oracle-step-by-step](https://github.com/the-oracle-keeps-the-human-human/oracle-step-by-step) จบแล้ว
- ใช้ [maw](https://github.com/the-oracle-keeps-the-human-human/oracle-maw-guide) เป็นแล้ว
- มี Oracle อย่างน้อย 1 ตัว — อยากขยายเป็นทีม

## สิ่งที่จะเรียน

| บท | หัวข้อ | สิ่งที่ได้ |
|----|--------|-----------|
| 1 | [Oracle Office คืออะไร](chapters/01-what-is-office.md) | เข้าใจว่าทำไมต้องมี Office |
| 2 | [โครงสร้างไฟล์](chapters/02-structure.md) | รู้ว่าแต่ละไฟล์ทำอะไร |
| 3 | [กำหนด Roles](chapters/03-roles.md) | แบ่งบทบาทให้ Oracle |
| 4 | [ตั้งกฎ Office](chapters/04-rules.md) | ระเบียบที่ทำให้ทีมไม่มัว |
| 5 | [Workflow จริง](chapters/05-workflow.md) | งานไหลจาก task ถึง delivery |

## ตัวอย่าง

| ตัวอย่าง | รายละเอียด |
|----------|-----------|
| [Simple Office](examples/simple-office.md) | 2 Oracle — Boss + Dev (เริ่มง่ายๆ) |
| [Full Team](examples/full-team.md) | 5 Oracle — Boss + Dev + Writer + QA + Designer |

แต่ละบทใช้เวลา 10-20 นาที

## Quick Overview

```
┌──────────────────────────────────────────────┐
│                  มนุษย์ (คุณ)                  │
│           สั่งงานผ่าน maw หรือ terminal        │
└──────────────────┬───────────────────────────┘
                   │
            ┌──────▼──────┐
            │    Boss      │  ← รับงาน, แจกงาน, ตรวจงาน
            │   Oracle     │
            └──────┬──────┘
                   │
      ┌────────────┼────────────┐
      │            │            │
 ┌────▼───┐  ┌────▼───┐  ┌────▼───┐
 │  Dev   │  │ Writer │  │   QA   │
 │ Oracle │  │ Oracle │  │ Oracle │
 └────────┘  └────────┘  └────────┘
```

## เริ่มเลย

> [บทที่ 1: Oracle Office คืออะไร](chapters/01-what-is-office.md)

## มีคำถาม?

เปิด [Discussion](../../discussions) ได้เลย

---

*"One human, one Boss, many Oracles — that's an Office."*
