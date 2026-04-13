# 🤖 PROMPT สำหรับ AI Agent ตัวใหม่

คัดลอกทั้งหมดนี้ไปวางให้ AI agent ตัวใหม่ได้เลย

---

```
คุณกำลังสานต่อโปรเจ็ค oracle-multi-agent v5.0
เป้าหมาย: ทำให้ครบ 100% ตาม Oracle ecosystem ทุกอย่าง

Repo: https://github.com/dmz2001TH/oracle-multi-agent
Working dir: clone แล้ว cd เข้าไป

════════
ขั้นตอนแรก
════════

1. อ่าน HANDOFF.md — มีรายการละเอียด 31 tasks ที่ต้องทำ
2. อ่าน src/index.ts — entry point
3. อ่าน src/api/agent-bridge.ts — Agent API
4. อ่าน src/agents/manager.js — AgentManager + AGENT_ROLES
5. อ่าน docs/HOW-TO-ADD-AGENTS.md

════════
ทำทีละ Batch เรียงตามนี้
════════

────────────────────────
BATCH 1: CLI Commands (ทุกคำสั่งที่คู่มือ Oracle กล่าวถึง)
────────────────────────

สร้างไฟล์ใน src/commands/ ทีละตัว:

1. /awaken — Identity Setup Ceremony
   - ถามผู้ใช้ 3 คำถาม: ชื่อ, บุคลิก, สิ่งที่สนใจ
   - สร้าง ψ/memory/identity.md
   - บันทึก identity ลง SQLite memory
   - อ้างอิง 5 principles จาก "รูปสอนสุญญตา"
   - ดู pattern จาก _ref/oracle-framework/

2. /recap — Session Summary
   - อ่าน memories จาก SQLite (24h ล่าสุด)
   - สร้าง summary: ทำอะไรไป, เรียนรู้อะไร, ต้องทำต่อ

3. /fyi <info> — Save to Memory
   - บันทึกเป็น memory entry (category: note)
   - auto-tag จาก content

4. /rrr — Daily Retrospective
   - สรุปทั้งวันจาก memories + messages + tasks
   - บันทึก learnings สำคัญ

5. /standup — Daily Standup
   - แสดง: tasks pending, ทำเมื่อวาน, blockers

6. /feel <mood> — Mood Logger
   - เก็บ mood entry, ปรับการทำงานตาม mood

7. /forward — Session Handoff
   - สร้าง handoff file ใน ψ/inbox/

8. /trace [query] — Universal Search
   - ค้นใน git log + grep files + SQLite memory
   - --deep mode: ค้นเชิงลึก, วิเคราะห์ dependencies

9. /learn [repo] — Study Repository
   - git clone --depth 1
   - อ่าน README + package.json + key files
   - สร้าง summary + บันทึก learnings

10. /who-are-you — Oracle Identity
    - อ่าน ψ/memory/identity.md
    - แสดง persona + principles + history

────────────────────────
BATCH 2: ดึง External Tools เข้ามาใช้ (Adapt ให้เป็นของเรา)
────────────────────────

ดึง source code จาก repos ภายนอกมาดู แล้ว adapt เข้าระบบเรา:

11. oracle-skills-cli — ดึง 30+ skills มาใช้
    - Clone: git clone --depth 1 https://github.com/Soul-Brews-Studio/arra-oracle-skills-cli.git /tmp/skills-cli
    - ดูว่ามี skills อะไรบ้าง
    - แต่ละ skill = ความสามารถที่เพิ่มให้ agent
    - แปลงให้ทำงานใน oracle-multi-agent (ไม่ต้องพึ่ง Claude Code)
    - สร้างเป็น plugins ใน src/plugins/ หรือ tools ใน src/memory/tools/

12. oracle-v3 (memory core) — ดึง memory patterns
    - Clone: git clone --depth 1 https://github.com/Soul-Brews-Studio/arra-oracle-v3.git /tmp/oracle-v3
    - ดู MCP server architecture
    - ดึง patterns มาใช้กับ memory system ของเรา

13. maw-js — ดึง transport + fleet patterns
    - มีอยู่แล้วใน _ref/maw-js/
    - ดู CLI commands, fleet management, transport layer
    - ดึงมาใช้กับ fleet commands ของเรา

14. oracle-vault-report — Integrate เข้า dashboard
    - มีอยู่แล้วใน _ref/vault-report/
    - สร้างหน้า Vault ใน dashboard
    - แสดง: repo count, file count, skills, sync status
    - สร้าง API endpoint /api/vault/stats

15. pulse-cli — Project Board
    - สร้าง CLI สำหรับ project board
    - เชื่อม GitHub Issues API
    - แสดง timeline, task assignment
    - สร้าง src/commands/pulse-enhanced.ts

16. multi-agent-workflow-kit — ดู Python patterns
    - มีอยู่แล้วใน _ref/workflow-kit/
    - ดู orchestration patterns
    - แปลงมาเป็น TypeScript

17. claude-code-statusline — Terminal status line
    - Clone: git clone --depth 1 https://github.com/nazt/claude-code-statusline.git /tmp/statusline
    - สร้าง status line สำหรับ terminal
    - แสดง: เวลา, project, agent, context usage

18. หนังสือ "รูปสอนสุญญตา" — ดึง 5 principles
    - Fetch: https://book.buildwithoracle.com
    - ดึง 5 principles มาใส่ใน Oracle identity system
    - ใช้เป็น foundation ของ /awaken

────────────────────────
BATCH 3: Semantic Search (เปลี่ยน TF-IDF เป็น Embedding จริง)
────────────────────────

19. npm install @xenova/transformers
20. แก้ src/memory/vector/factory.ts — ใช้ real embeddings (all-MiniLM-L6-v2)
21. แก้ src/memory/tools/search.ts — hybrid: FTS5 keyword + vector semantic
22. ทดสอบ: บันทึก memory หลายๆ ตัว, ค้นหาด้วย semantic query

────────────────────────
BATCH 4: ψ/ Structure & Vault
────────────────────────

23. สร้าง ψ/ directory structure (inbox/, memory/, writing/, lab/, outbox/, sessions/, traces/, threads/)
24. สร้าง Vault API: GET/POST /api/vault/:section
25. สร้างหน้า Vault ใน dashboard

────────────────────────
BATCH 5: Production & VPS
────────────────────────

26. สร้าง docs/VPS-DEPLOY.md
    - Ubuntu 22.04 setup
    - Node.js 20 + tmux + git
    - PM2 setup (มี ecosystem.config.cjs แล้ว)
    - nginx reverse proxy config
    - SSL with certbot

27. สร้าง oracle-multi-agent.service (systemd)

28. สร้าง Dockerfile + docker-compose.yml

────────────────────────
BATCH 6: Testing & Documentation
────────────────────────

29. End-to-end test: spawn → chat → memory → search → dashboard
30. API test suite
31. อัพเดท README.md

════════
วิธีรัน
════════

git pull origin main
npm install
npx tsx src/index.ts
# เปิด http://localhost:3456

════════
วิธีอัพขึ้น GitHub
════════

git add -A
git commit -m "descriptive message"
git remote set-url origin https://dmz2001TH:TOKEN@github.com/dmz2001TH/oracle-multi-agent.git
git push origin main
git remote set-url origin https://github.com/dmz2001TH/oracle-multi-agent.git

TOKEN = ถามเจ้าของโปรเจ็ค

════════
สำคัญ
════════

- ทำทีละ batch เสร็จแล้ว commit + push ทุกครั้ง
- ดึง source code จาก external repos มาดูได้ (git clone --depth 1)
- Adapt ทุกอย่างให้เข้ากับระบบเรา ไม่ต้อง copy ตรงๆ
- ถ้า TypeScript compile error → แก้ก่อน commit
- หลักการ: "Nothing is Deleted" — ไม่ลบโค้ดเก่า แต่ปรับปรุงแทน
```
