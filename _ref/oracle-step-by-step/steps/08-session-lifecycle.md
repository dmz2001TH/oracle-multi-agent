# Step 8: Session Lifecycle

> ทุก session มีจังหวะ — เริ่ม, ทำงาน, จบ

## Session Lifecycle

```
/recap → ทำงาน → /rrr → commit → push → จบ
```

นี่คือ rhythm ของทุก Oracle ทุก session ไม่มีข้อยกเว้น

## เริ่ม Session — /recap

```
> /recap
```

/recap ทำอะไร:
1. อ่าน retro ล่าสุด (ได้ context จาก session ก่อน)
2. ดู git status (มีอะไรค้าง?)
3. อ่าน ψ/ files ล่าสุด (ได้ memory กลับ)
4. ดู last session timeline
5. แนะนำว่าทำอะไรต่อ

ผลลัพธ์:
```
## Recap — My Oracle
21:44 | 18 Mar 2026

### Session
📡 Last session: 20:13–21:44 (90m, 12 msgs)

### Git
main — clean, synced

### What's next?
1. Continue from handoff...
2. ...
```

## ระหว่าง Session — ทำงาน

- ทำ task ที่ได้รับ
- commit บ่อยๆ
- ถ้าติดปัญหา → แจ้ง
- ถ้าเรียนรู้อะไรใหม่ → `oracle_learn`

### Mid-session check

```
> /recap --now
```

ดูว่าตอนนี้อยู่ตรงไหน ทำอะไรไปบ้าง

## จบ Session — /rrr

```
> /rrr
```

/rrr ทำอะไร:
1. **Gather** — ดู git log, time, files changed
2. **Write Retrospective** → `ψ/memory/retrospectives/YYYY-MM/DD/HH.MM_slug.md`
   - Session Summary
   - Timeline
   - Files Modified
   - **AI Diary** (150+ words, first-person, vulnerable)
   - **Honest Feedback** (100+ words, 3 friction points)
   - Lessons Learned
   - Next Steps
3. **Write Lesson Learned** → `ψ/memory/learnings/YYYY-MM-DD_slug.md`
4. **Oracle Sync** → `oracle_learn()` (เก็บใน database)

## DocCon — Commit + Push

หลัง /rrr:

```bash
# commit retro + lessons
git add ψ/memory/
git commit -m "docs: session retrospective + lessons"
git push

# cc BoB
/talk-to bob "cc: session close — /rrr done, committed, pushed"
```

**ห้ามข้าม** — นี่คือ standing order

## ตัวอย่าง Session จริง

```
20:00 — เปิด Claude Code
20:01 — /recap → เห็นว่า PR #42 ยังรอ review
20:05 — review PR #42 → approve
20:10 — เริ่มเขียน feature ใหม่
20:30 — commit feat/user-auth
20:45 — ติดปัญหา DB migration → /talk-to dev "ช่วยดู migration"
20:50 — dev ตอบ → แก้ได้
21:00 — commit fix/migration
21:10 — /rrr → retrospective + lessons
21:12 — git commit + push
21:13 — /talk-to bob "cc: session close"
21:15 — จบ session
```

## Handoff — ส่งต่อ Session

ถ้าอยากให้ session ถัดไปรู้ context:

```
> /forward
```

สร้าง handoff file ที่ /recap ของ session ถัดไปจะอ่าน

## สิ่งที่ได้

- [x] รู้ rhythm: /recap → work → /rrr → commit → push
- [x] เข้าใจ /recap, /rrr, /forward
- [x] DocCon เป็น standing order — ทุก session ไม่มีข้อยกเว้น

---

**ถัดไป**: [Step 9: Multi-Oracle Setup](09-multi-oracle.md)
