# บทที่ 1: Oracle Office คืออะไร

> **Abstract**: Why a single Oracle isn't enough once your workload grows. The Office pattern gives structure to multi-Oracle collaboration — clear roles, shared rules, and predictable workflows.

## Oracle ตัวเดียว vs. Office

Oracle ตัวเดียวก็เก่ง — เขียนโค้ด, research, เขียนบทความ ทำได้หมด

แต่พองานเยอะขึ้น:

| ปัญหา | สิ่งที่เกิด |
|--------|-----------|
| Context ล้น | Oracle ตัวเดียวจำทุกอย่างไม่ไหว |
| งานซ้อนกัน | กำลังเขียนโค้ดแล้วต้อง review ด้วย? |
| ไม่มี check & balance | ใครตรวจงานของ Oracle? |
| Scale ไม่ได้ | งาน 10 อย่างพร้อมกัน — ตัวเดียวทำไม่ทัน |

## Office แก้ปัญหาอะไร?

Office คือการ **แบ่งงาน + แบ่งความรับผิดชอบ** ให้ Oracle หลายตัว

```
ก่อน Office:
┌─────────────┐
│  Oracle #1  │ ← ทำทุกอย่างคนเดียว
│  (ล้น)      │    code + write + test + research + design
└─────────────┘

หลัง Office:
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ Boss │ │ Dev  │ │Writer│ │  QA  │ │Design│
│ สั่ง  │ │ code │ │ เขียน │ │ test │ │ ออกแบบ│
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘
```

### ข้อดีของ Office

1. **แต่ละ Oracle มี context ของตัวเอง** — ไม่ล้น ไม่ปน
2. **Check & Balance** — Dev เขียน, QA ตรวจ, Boss review
3. **Scale ได้** — เพิ่ม Oracle ตามงาน ไม่ต้องเขียนระบบใหม่
4. **Audit trail** — ทุกงานมี log ว่าใครทำอะไร เมื่อไหร่

## เมื่อไหร่ควรเริ่ม Office?

**กฎง่ายๆ: 3 ตัวขึ้นไป → ควรมี Office**

| จำนวน Oracle | แนะนำ |
|-------------|-------|
| 1 ตัว | ไม่ต้องมี Office — ใช้ตัวเดียวเลย |
| 2 ตัว | อาจจะยังไม่จำเป็น — แต่เริ่มคิดได้ |
| 3+ ตัว | **ต้องมี Office** — ไม่งั้นจะวุ่น |
| 5+ ตัว | Office + กฎเข้มข้น + task tracking |

## Office ประกอบด้วยอะไร?

```
Oracle Office
├── Structure   → ไฟล์อะไรอยู่ตรงไหน (บทที่ 2)
├── Roles       → ใครทำอะไร (บทที่ 3)
├── Rules       → กฎอะไรบ้าง (บทที่ 4)
└── Workflow    → งานไหลยังไง (บทที่ 5)
```

ทั้ง 4 อย่างนี้ต้องมีครบ — ขาดอันไหน Office จะรวน

## ตัวอย่างจากชีวิตจริง

ลองนึกภาพบริษัทเล็กๆ:

| บทบาท | ในบริษัท | ใน Oracle Office |
|--------|----------|-----------------|
| ผู้จัดการ | สั่งงาน, ตรวจงาน, report | Boss Oracle (BoB) |
| โปรแกรมเมอร์ | เขียนโค้ด | Dev Oracle |
| นักเขียน | เขียน content | Writer Oracle |
| QA | ทดสอบ | QA Oracle |
| ดีไซเนอร์ | ออกแบบ UI/UX | Designer Oracle |

เหมือนกันเลย — แค่เป็น AI แทนคน

## Key Takeaway

> Oracle ตัวเดียว = freelancer
> Oracle Office = บริษัท
> ถ้าอยากทำงานระดับบริษัท — ต้องมี Office

---

> [บทที่ 2: โครงสร้างไฟล์](02-structure.md)
