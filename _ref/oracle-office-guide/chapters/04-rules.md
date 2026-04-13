# บทที่ 4: ตั้งกฎ Office

> **Abstract**: Rules keep an Oracle Office running smoothly. This chapter covers the essential rules — reporting, task management, no invisible work, and accountability — and how to encode them in CLAUDE.md so every Oracle follows them automatically.

## ทำไมต้องมีกฎ?

Oracle ไม่มีสามัญสำนึกแบบมนุษย์ — ถ้าไม่เขียนกฎ Oracle จะ:
- ทำงานเงียบๆ ไม่บอกใคร
- ลืม report ผลลัพธ์
- ทำงานซ้ำกับ Oracle อื่น
- ไม่มี audit trail — ไม่รู้ว่าใครทำอะไร

**กฎที่ดี = Office ที่ไม่มีดราม่า**

## กฎหลัก 6 ข้อ

### กฎที่ 1: cc Boss ทุกครั้ง

```
ทุกครั้งที่:
- เสร็จงาน → cc Boss
- เริ่มงาน → cc Boss
- ติดปัญหา → cc Boss
- ส่งงานให้ Oracle อื่น → cc Boss
```

**ทำไม?** Boss ต้องรู้ทุกอย่างที่เกิดขึ้น — ถ้า Boss ไม่รู้ = งานไม่มีอยู่จริง

ใส่ใน CLAUDE.md:

```markdown
### กฎที่ 1: cc Boss ทุกครั้ง
- เสร็จงาน → `/talk-to bob "cc: [task] — done"`
- เริ่มงาน → `/talk-to bob "cc: starting [task]"`
- ติดปัญหา → `/talk-to bob "cc: stuck on [X]"`
- ส่งงานต่อ → `/talk-to bob "cc: sent [task] to [oracle]"`
```

### กฎที่ 2: ห้าม Idle — ได้งานแล้วทำเลย

```
ได้ task → ทำเลย
ไม่ใช่: ได้ task → "ทำไหมครับ?" → รอคำตอบ → ทำ
```

Oracle ที่ถามว่า "ให้ทำไหม?" ทุกครั้ง = เสียเวลา

### กฎที่ 3: ตอบทุกข้อความ — ห้ามเงียบ

```
Oracle อื่นส่งข้อความมา → ต้องตอบ
ตอบ, ทำ, หรือ push back ก็ได้ — แต่ห้ามเพิกเฉย
```

### กฎที่ 4: No Invisible Work

นี่คือกฎสำคัญที่สุด:

```
ถ้าไม่มี ticket = งานไม่มีอยู่จริง
ถ้าไม่มี log = ไม่ได้ทำ
ถ้าไม่มี commit = ไม่ได้เปลี่ยน
```

**ทุกงานต้อง**:
1. มี ticket (GitHub issue หรือ task)
2. มี log (เริ่ม, progress, เสร็จ)
3. มี commit (ถ้าเป็น code)

### กฎที่ 5: Task Lifecycle

ทุก task ต้องผ่าน lifecycle นี้:

```
┌──────┐     ┌──────┐     ┌──────┐     ┌──────┐
│ Open │ ──► │Start │ ──► │ Log  │ ──► │ Done │
│      │     │      │     │      │     │      │
│สร้าง  │     │เริ่มทำ│     │ progress│   │ปิด   │
└──────┘     └──────┘     └──────┘     └──────┘
```

```bash
# สร้าง task
maw task add my-project "Build login page"

# เริ่มทำ
maw task start #42

# log ระหว่างทำ
maw task log #42 "Created form component"

# เสร็จ
maw task done #42
```

### กฎที่ 6: Handoff ต้อง ACK

เมื่อส่งงานให้ Oracle อื่น:

```
ผู้ส่ง: /talk-to dev "ช่วย fix bug #123"
Dev:    /talk-to bob "cc: bob assigned me bug #123"   ← ภายใน 2 นาที
```

**ถ้าไม่ได้ ACK ภายใน 2 นาที = งานอาจตกหล่น** → escalate ให้ Boss

## วิธีใส่กฎใน CLAUDE.md

เพิ่ม section `## THE LAW` ใน CLAUDE.md ของทุก Oracle:

```markdown
## THE LAW (ห้ามละเมิด)

### 1. cc Boss ทุกครั้ง
เสร็จงาน/เริ่มงาน/ติดปัญหา/ส่งงานต่อ → `/talk-to bob "cc: ..."`

### 2. ห้าม Idle
ได้ task แล้วทำเลย ห้ามถาม "ให้ทำไหม?"

### 3. ตอบทุกข้อความ
Oracle อื่นส่งมา → ต้องตอบเสมอ

### 4. No Invisible Work
ทุก task ต้องมี: ticket + log + commit (ถ้าเป็น code)

### 5. Task Lifecycle
Open → Start → Log → Done — ห้ามข้าม

### 6. Handoff ACK
ได้รับงาน → ACK ภายใน 2 นาที
```

## Golden Rules — กฎที่ห้ามละเมิดเด็ดขาด

นอกจาก THE LAW แล้ว ควรมี Golden Rules ที่ specific กับ Office:

```markdown
## Golden Rules

- Never `git push --force`
- Never commit secrets (.env, API keys, passwords)
- Never merge PRs without QA review
- Never deploy to production without Boss approval
- Always create a new branch for each task
```

## ตัวอย่างกฎเพิ่มเติม

| กฎ | เหตุผล |
|----|-------|
| ห้ามแก้ไฟล์ของ Oracle อื่น | แต่ละตัวดูแล repo ตัวเอง |
| Context 80% = หยุด + handoff | ป้องกัน context ล้น |
| ทุกเช้าต้อง standup | Boss รู้ว่าใครทำอะไร |
| ทุกเย็นต้อง retrospective | เรียนรู้จาก session |

## Key Takeaway

> กฎไม่ใช่การควบคุม — กฎคือการสร้างระเบียบ
> Oracle ที่มีกฎชัดเจน ทำงานได้ดีกว่า Oracle ที่อิสระ 100%

---

> [บทที่ 5: Workflow จริง](05-workflow.md)
