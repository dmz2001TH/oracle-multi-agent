# ตัวอย่าง: Full Team — Boss + Dev + Writer + QA + Designer

> Office เต็มรูปแบบ — 5 Oracle ทำงานเหมือนบริษัทจริง

## สถานการณ์

คุณกำลังสร้าง web app — ต้องการทีมครบ:

| Oracle | Role | หน้าที่หลัก |
|--------|------|-----------|
| Boss (BoB) | Project Manager | สั่งงาน, ตรวจงาน, report |
| Dev | Developer | เขียนโค้ด, deploy |
| Writer | Content Writer | เขียน docs, README, blog |
| QA | Quality Assurance | review code, run tests |
| Designer | UI/UX Designer | ออกแบบ, mockup, assets |

## ขั้นที่ 1: สร้าง 5 Repos

```bash
for oracle in boss dev writer qa designer; do
  mkdir -p ~/oracles/${oracle}-oracle
  cd ~/oracles/${oracle}-oracle
  git init
  echo "# ${oracle^} Oracle" > CLAUDE.md
  git add CLAUDE.md && git commit -m "init: ${oracle} oracle"
done
```

จากนั้นเปิดแต่ละ repo ด้วย `claude` → `/awaken` เพื่อตั้ง identity

## ขั้นที่ 2: CLAUDE.md — Team Section (ใส่ทุกตัว)

ทุก Oracle ต้องมี team section เหมือนกัน:

```markdown
## Team

**The team**: bob, dev, writer, qa, designer

| Oracle | Role | เมื่อไหร่ต้องคุย |
|--------|------|-----------------|
| bob | Boss — สั่งงาน, review | report ทุกงาน, ขอ approval |
| dev | Dev — เขียนโค้ด | ส่ง code task, technical Q |
| writer | Writer — เขียน content | ส่ง docs task, content review |
| qa | QA — ตรวจสอบ | ส่ง PR review, report bug |
| designer | Designer — ออกแบบ | ส่ง design task, UI specs |

### วิธีคุย
- **Primary**: `/talk-to <oracle> "message"`
- **Fallback**: `maw hey <oracle> "message"`
- **cc Boss ทุกครั้ง**: `/talk-to bob "cc: [action]"`
```

## ขั้นที่ 3: Fleet Config

```bash
mkdir -p ~/.maw/fleet

oracles=("bob:1" "dev:2" "writer:3" "qa:4" "designer:5")
for entry in "${oracles[@]}"; do
  name="${entry%%:*}"
  num="${entry##*:}"
  cat > ~/.maw/fleet/${name}.json << EOF
{
  "oracle": "${name}",
  "window": ${num},
  "repo": "your-name/${name}-oracle",
  "path": "/home/you/oracles/${name}-oracle",
  "tmux": "0${num}-${name}:0",
  "dormant": false
}
EOF
done
```

## ขั้นที่ 4: ปลุกทั้งทีม

```bash
maw wake all

# ตรวจสถานะ
maw oracle ls
```

ควรเห็น 5 Oracle ทั้งหมด online

## ขั้นที่ 5: ทดสอบ Workflow จริง

### สั่ง Boss

```bash
maw hey bob "สร้าง landing page สำหรับ product launch — ต้องมี design, code, docs, และ test"
```

### Boss วิเคราะห์ + แจกงาน

Boss จะ:

```
1. สร้าง GitHub issue #10 "Landing page for product launch"
2. แบ่ง sub-tasks:
   - Design: mockup + assets
   - Dev: implement frontend
   - Writer: copy + docs
   - QA: test plan + review

3. สั่งงาน:
/talk-to designer "ออกแบบ landing page mockup — issue #10"
/talk-to writer "เขียน copy สำหรับ landing page — issue #10"
/talk-to qa "เตรียม test plan สำหรับ landing page — issue #10"
```

### งานไหล

```
Phase 1 — Parallel Prep
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Designer │  │  Writer  │  │    QA    │
│ mockup   │  │  copy    │  │test plan │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │              │              │
     ▼              ▼              ▼
  cc Boss        cc Boss       cc Boss

Phase 2 — Dev Build
     Design + Copy พร้อม
          │
     ┌────▼────┐
     │   Dev   │  ← ใช้ design + copy implement
     │  build  │
     └────┬────┘
          │
          ▼
       cc Boss + ส่ง QA

Phase 3 — QA Review
     ┌────────┐
     │   QA   │  ← ใช้ test plan ตรวจ
     │ review │
     └────┬───┘
          │
     ┌────▼─── ผ่าน? ───────┐
     │ Yes                  │ No
     ▼                      ▼
  cc Boss              /talk-to dev
  "approved"           "fix: [issues]"
                            │
                       Dev แก้ → QA ตรวจอีกรอบ

Phase 4 — Boss Deliver
     ┌───────┐
     │ Boss  │ ← review ทั้งหมด
     │ merge │
     └───┬───┘
         │
         ▼
    report มนุษย์
    "landing page เสร็จแล้ว"
```

## Communication Log ตัวอย่าง

นี่คือ log จริงที่ควรเกิดขึ้น:

```
[Boss]     → designer: "ออกแบบ landing page — #10"
[Boss]     → writer:   "เขียน copy — #10"
[Boss]     → qa:       "เตรียม test plan — #10"

[Designer] → bob: "cc: design done for #10 — mockup at figma.com/..."
[Writer]   → bob: "cc: copy ready for #10"
[QA]       → bob: "cc: test plan ready for #10"

[Boss]     → dev: "implement landing page — design + copy พร้อมแล้ว — #10"

[Dev]      → bob: "cc: PR #11 ready — landing page"
[Dev]      → qa:  "review PR #11"

[QA]       → dev: "PR #11 — found 1 issue: button not responsive"
[QA]       → bob: "cc: PR #11 needs fix"

[Dev]      → qa:  "fixed — updated PR #11"
[Dev]      → bob: "cc: fix pushed to PR #11"

[QA]       → bob: "cc: PR #11 approved"

[Boss]     → human: "landing page เสร็จ — PR #11 merged"
```

## Task Board View

```
maw task ls

┌──────┬──────────┬──────────┬────────┬─────────────┐
│  ID  │  Task    │ Assignee │ Status │ Updated     │
├──────┼──────────┼──────────┼────────┼─────────────┤
│ #10  │ Landing  │ Boss     │ Done   │ 30 min ago  │
│ #10a │ Design   │ Designer │ Done   │ 25 min ago  │
│ #10b │ Copy     │ Writer   │ Done   │ 20 min ago  │
│ #10c │ Build    │ Dev      │ Done   │ 10 min ago  │
│ #10d │ Test     │ QA       │ Done   │ 5 min ago   │
└──────┴──────────┴──────────┴────────┴─────────────┘
```

## Tips สำหรับ Full Team

### 1. Boss ต้องชัดเจน

```
ดี:  "ออกแบบ login page — mobile-first, dark theme, ดู issue #10 สำหรับ requirements"
ไม่ดี: "ช่วยออกแบบหน่อย"
```

### 2. ตั้ง Loop สำหรับ Boss

```bash
maw loop add '{
  "id": "boss-standup",
  "oracle": "bob",
  "tmux": "01-bob:0",
  "schedule": "0 9 * * *",
  "prompt": "Morning standup — ตรวจ task board, ดูว่าใครติดอะไร, วางแผนวันนี้",
  "requireIdle": true,
  "enabled": true,
  "description": "Daily morning standup"
}'
```

### 3. อย่าให้ Oracle ข้าม Boss

```
ถูก:  Dev → Boss → QA
ผิด:  Dev → QA → Boss (Boss ตามไม่ทัน)
```

ยกเว้น: direct technical discussion ระหว่าง Dev-QA ได้ — **แต่ต้อง cc Boss**

### 4. เพิ่ม Oracle ทีละตัว

ไม่ต้องสร้าง 5 ตัวพร้อมกัน — เริ่มจาก Boss + Dev แล้วค่อยเพิ่ม:

```
Week 1: Boss + Dev
Week 2: + QA (ตอนนี้มี review process)
Week 3: + Writer (ตอนนี้มี docs)
Week 4: + Designer (ตอนนี้มี design process)
```

## Key Takeaway

> Full Team ให้ power มาก — แต่ต้องมีวินัย
> Boss เป็นหัวใจ — ถ้า Boss ดี ทีมดี
> ค่อยๆ เพิ่ม — อย่า scale เร็วเกินไป

---

*"A well-run Office is indistinguishable from a well-run company."*
