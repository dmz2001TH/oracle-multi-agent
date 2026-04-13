# บทที่ 5: Workflow จริง

> **Abstract**: A complete walkthrough of how work flows through an Oracle Office — from human request to final delivery. Covers task routing, execution chains, review loops, and the Boss pattern.

## งานไหลยังไงใน Office?

ทุกงานใน Office ไหลตาม pattern เดียวกัน:

```
มนุษย์ สั่งงาน
    │
    ▼
  Boss รับ → วิเคราะห์ → แจกงาน
    │
    ├──► Dev ทำ code
    │      │
    │      ▼
    ├──► QA ตรวจ
    │      │
    │      ▼
  Boss review ← ผลลัพธ์กลับมา
    │
    ▼
มนุษย์ ได้ผลลัพธ์
```

## ตัวอย่าง: สร้าง Feature ใหม่

### ขั้นที่ 1: มนุษย์สั่ง Boss

```bash
maw hey bob "สร้าง login page สำหรับ web app"
```

### ขั้นที่ 2: Boss วิเคราะห์และแจกงาน

Boss จะ:
1. สร้าง GitHub issue
2. แบ่งงานเป็น sub-tasks
3. ส่งให้ Oracle ที่เหมาะสม

```
Boss คิด:
"login page ต้องมี — UI design, frontend code, tests"

Boss สั่ง:
/talk-to designer "ออกแบบ login page — issue #50"
/talk-to dev "รอ design แล้ว implement login page — issue #50"
/talk-to qa "prepare test cases สำหรับ login page — issue #50"
```

### ขั้นที่ 3: Oracle ทำงาน (Parallel)

```
┌─────────┐  ┌─────────┐  ┌─────────┐
│Designer │  │   Dev   │  │   QA    │
│         │  │         │  │         │
│ ออกแบบ   │  │  (รอ    │  │ เขียน    │
│ mockup  │  │ design) │  │test case│
└────┬────┘  └─────────┘  └────┬────┘
     │                         │
     │  design เสร็จ             │  test cases เสร็จ
     ▼                         ▼
/talk-to dev              /talk-to bob
"design เสร็จ — ดูที่ #50"   "test cases ready for #50"
/talk-to bob
"cc: design done for #50"
```

### ขั้นที่ 4: Dev Implement

Dev ได้ design แล้ว → เริ่ม code:

```bash
# Dev ทำ
maw task start #50
# ... เขียนโค้ด ...
git commit -m "feat: add login page"
maw task log #50 "Implemented login page, PR #51 ready"

# Dev ส่ง QA
/talk-to qa "review PR #51 — login page"
/talk-to bob "cc: login page PR #51 sent to QA"
```

### ขั้นที่ 5: QA Review

```bash
# QA ตรวจ PR
# ... run tests, review code ...

# ถ้าผ่าน
/talk-to dev "PR #51 approved — no issues"
/talk-to bob "cc: PR #51 approved"

# ถ้าไม่ผ่าน
/talk-to dev "PR #51 needs fixes — found 2 bugs: [details]"
/talk-to bob "cc: PR #51 needs fixes"
```

### ขั้นที่ 6: Boss Review & Deliver

```bash
# Boss review ผลลัพธ์ทั้งหมด
# ถ้า QA approved → Boss merge
# report กลับมนุษย์

/talk-to human "login page เสร็จแล้ว — PR #51 merged, deployed to staging"
maw task done #50
```

## Workflow Patterns ที่ใช้บ่อย

### Pattern 1: Sequential Chain

```
Boss → Dev → QA → Boss → Human
เหมาะกับ: งาน code ที่ต้อง review
```

### Pattern 2: Parallel Fan-out

```
         ┌→ Dev (code)
Boss ────┼→ Writer (docs)
         └→ Designer (UI)
              │
         Boss ←───── รวมผลลัพธ์
เหมาะกับ: งานใหญ่ที่แบ่งได้
```

### Pattern 3: Review Loop

```
Dev → QA → Dev → QA → ... → Boss
เหมาะกับ: งานที่ต้อง iterate หลายรอบ
```

### Pattern 4: Research → Build

```
Boss → Researcher → Boss (สรุป) → Dev (build) → QA → Boss
เหมาะกับ: งานที่ต้อง research ก่อน
```

## สิ่งสำคัญใน Workflow

### 1. Boss ต้องเป็น Hub

```
ถูก:  Dev → Boss → QA
ผิด:  Dev → QA (ข้าม Boss)
```

Boss ต้องรู้ทุก movement — ไม่งั้น track ไม่ได้

### 2. ทุก Handoff ต้องมี Context

```
ผิด:  /talk-to dev "ช่วยแก้ bug"
ถูก:  /talk-to dev "fix bug #123 — login ไม่ได้เมื่อ password มี special chars, ดู error log ที่ issue"
```

Context ที่ดี = Oracle ทำงานได้เลย ไม่ต้องถามกลับ

### 3. Blocking ต้อง Escalate

```
Dev ส่ง QA แล้วรอ — QA ไม่ตอบ 5 นาที
→ Dev: /talk-to bob "cc: QA ไม่ตอบเรื่อง PR #51"
→ Boss ไป poke QA หรือ reassign
```

**ห้ามรอเฉยๆ** — ติดปัญหาต้อง escalate ทันที

## Dashboard View

เมื่อทุก Oracle ทำตาม workflow — Boss จะเห็นภาพรวม:

```
┌─────────────────────────────────────────────┐
│              Office Dashboard                │
├───────┬──────────┬──────────┬───────────────┤
│ Task  │ Assignee │ Status   │ Last Update   │
├───────┼──────────┼──────────┼───────────────┤
│ #50   │ Dev      │ In PR    │ 2 min ago     │
│ #51   │ QA       │ Review   │ 5 min ago     │
│ #52   │ Writer   │ Writing  │ 10 min ago    │
│ #53   │ Designer │ Done     │ 15 min ago    │
└───────┴──────────┴──────────┴───────────────┘
```

ดูด้วย:

```bash
maw task ls              # task board
maw project show myproj  # project view
maw oracle ls            # Oracle status
```

## Key Takeaway

> Workflow ที่ดี = งานไหลได้ ไม่ติด ไม่ตก
> Boss เป็น hub — ทุก handoff cc Boss
> ติดปัญหา = escalate ทันที อย่ารอ

---

ยินดีด้วย! จบ 5 บทแล้ว ลองดูตัวอย่างจริง:

> [ตัวอย่าง: Simple Office (2 Oracle)](../examples/simple-office.md)
> [ตัวอย่าง: Full Team (5 Oracle)](../examples/full-team.md)
