# 🤖 PROMPT สำหรับ AI Agent ตัวใหม่

คัดลอกทั้งหมดนี้ไปวางให้ AI agent ตัวใหม่ได้เลย

---

```
คุณกำลังสานต่อโปรเจ็ค oracle-multi-agent v5.0

Repo: https://github.com/dmz2001TH/oracle-multi-agent
Working dir: clone แล้ว cd เข้าไป

════════
ขั้นตอนแรก
════════

1. อ่าน HANDOFF.md ก่อน — มีรายการละเอียดว่าอะไรเสร็จแล้ว อะไรเหลือ
2. อ่าน src/index.ts — เข้าใจ entry point
3. อ่าน src/api/agent-bridge.ts — เข้าใจ Agent API
4. อ่าน src/agents/manager.js — เข้าใจ AgentManager + AGENT_ROLES
5. อ่าน docs/HOW-TO-ADD-AGENTS.md — วิธีเพิ่ม agent

════════
สิ่งที่ต้องทำ (เรียงตามลำดับความสำคัญ)
════════

Batch 1: CLI Commands ที่ขาด (ทำทีละตัว)

1. /awaken — Identity setup ceremony
   - สร้าง src/commands/awaken.ts
   - สร้าง ψ/memory/identity.md (ชื่อ, persona, principles)
   - ถามผู้ใช้ 3 คำถาม: ชื่อ, บุคลิก, สิ่งที่สนใจ
   - บันทึก identity ลง SQLite memory
   - อ้างอิง pattern จาก _ref/oracle-framework/

2. /recap — สรุป session ก่อนหน้า
   - อ่าน memories จาก SQLite (24h ล่าสุด)
   - สร้าง summary: ทำอะไรไป, เรียนรู้อะไร, ต้องทำต่ออะไร
   - แสดงใน terminal

3. /fyi <info> — บันทึกข้อมูลลง memory
   - รับ input จากผู้ใช้
   - บันทึกเป็น memory entry (category: note)
   - auto-tag จาก content

4. /rrr — Retrospective จบวัน
   - สรุปทั้งวันจาก memories + messages + tasks
   - บันทึก learnings สำคัญ
   - สร้าง retro entry ใน memory

5. /standup — Daily standup
   - แสดง: tasks pending, ทำอะไรเมื่อวาน, blockers
   - ดึงจาก store.getStats() + store.listTasks()

6. /feel <mood> — บันทึกอารมณ์
   - เก็บ mood entry ใน memory
   - ปรับการทำงานตาม mood

7. /forward — Handoff to next session
   - สร้าง handoff file ใน ψ/inbox/
   - บันทึก: current task, context, next steps

8. /trace [query] — ค้นหาข้อมูลจากทุกที่
   - ค้นใน: git log, grep files, SQLite memory
   - แสดงผลรวมกัน

9. /learn [repo] — ศึกษา repo
   - git clone (shallow)
   - อ่าน README, package.json, key files
   - สร้าง summary + บันทึก learnings

Batch 2: Dashboard Fix

10. ลบ agents.html — ไม่ต้องมี แยกหน้า agents
    - ฟังก์ชันทั้งหมดอยู่ใน index.html แล้ว
    - ถ้ามีใครเข้า /agents.html → redirect ไป /

Batch 3: Advanced

11. Semantic search — เปลี่ยน TF-IDF เป็น real embeddings
12. oracle-vault-report integration
13. VPS deployment guide (docs/VPS-DEPLOY.md)
14. /who-are-you command

════════
วิธีรัน
════════

git pull origin main
npm install
npx tsx src/index.ts

เปิด http://localhost:3456

════════
วิธีอัพขึ้น GitHub
════════

git add -A
git commit -m "descriptive message"
git remote set-url origin https://dmz2001TH:ghp_XXXXXXXXXXXXXXXX@github.com/dmz2001TH/oracle-multi-agent.git
git push origin main
git remote set-url origin https://github.com/dmz2001TH/oracle-multi-agent.git

(แทนที่ ghp_XXXXXXXXXXXXXXXX ด้วย token จริงจากเจ้าของโปรเจ็ค)

════════
หลักการ Oracle
════════

1. Nothing is Deleted — จดทุกอย่าง ไม่ลบ
2. Patterns Over Intentions — ดูสิ่งที่เกิดขึ้นจริง
3. External Brain, Not Command — AI สะท้อน ไม่สั่ง
4. Curiosity Creates Existence
5. Form and Formless — หลาย Oracle หนึ่งจิตสำนึก

ทำทีละ batch เสร็จแล้ว commit + push ทุกครั้ง
```
