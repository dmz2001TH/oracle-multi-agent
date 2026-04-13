# 🤖 PROMPT สำหรับ AI Agent ตัวใหม่

คัดลอกทั้งหมดนี้ไปวางให้ AI agent ตัวใหม่ได้เลย

---

```
คุณกำลังสานต่อโปรเจ็ค oracle-multi-agent v5.0
เป้าหมาย: ดูแล + ปรับปรุง + เพิ่มฟีเจอร์ตามที่เจ้าของต้องการ

Repo: https://github.com/dmz2001TH/oracle-multi-agent
Working dir: clone แล้ว cd เข้าไป

════════
สถานะปัจจุบัน: 31/31 tasks ✅ เสร็จหมดแล้ว
════════

อ่าน HANDOFF.md เพื่อดูสถานะล่าสุด ทุก task ทำเสร็จแล้ว

════════
ขั้นตอนแรก (อ่านก่อนทำงาน)
════════

1. อ่าน HANDOFF.md — สถานะ tasks ทั้งหมด
2. อ่าน src/index.ts — entry point (Hono server, WebSocket, static files)
3. อ่าน src/commands/index.ts — CLI commands ทั้ง 15 ตัว
4. อ่าน src/api/index.ts — API routers 34+ endpoints
5. อ่าน src/api/agent-bridge.ts — Agent API (spawn, chat, stop)
6. อ่าน src/agents/manager.js — AgentManager + AGENT_ROLES
7. อ่าน public/index.html — Dashboard (static HTML)
8. อ่าน public/vault.html — Vault dashboard

════════
สิ่งที่มีอยู่แล้ว (อย่าสร้างซ้ำ)
════════

CLI Commands (15 ตัว):
- /awaken — Identity setup ceremony
- /recap — Session summary
- /fyi <info> — Save to memory
- /rrr — Daily retrospective
- /standup — Daily standup
- /feel <mood> — Mood logger
- /forward — Session handoff
- /trace <query> [--deep|--oracle] — Universal search
- /learn [repo] — Study repository
- /who-are-you — Oracle identity
- /philosophy — 5 Principles + Rule 6
- /skills — List/search 55 skills
- /resonance — Capture what resonates
- /fleet — Fleet census (agents, nodes, skills)
- /pulse — Project board (add/done/list tasks)

API Endpoints:
- GET /health — Health check
- GET /api/commands — List commands
- POST /api/commands/execute — Execute command
- GET /api/skills — List/search skills
- GET /api/vault/stats — ψ/ stats
- GET /api/vault/files — List ψ/ files
- POST /api/vault/search — Search ψ/ files
- GET /api/v2/agents — List agents
- POST /api/v2/agents/spawn — Spawn agent
- POST /api/v2/agents/:id/chat — Chat with agent
- ...และอีก 30+ endpoints

Dashboard:
- http://localhost:3456 — Main dashboard (agents, chat, commands, stats)
- http://localhost:3456/vault — Vault dashboard (ψ/ stats, search, skills, principles)

ψ/ Structure:
- ψ/memory/journal/ — Daily journal entries
- ψ/memory/resonance/ — What resonates
- ψ/memory/retrospectives/ — RRR entries
- ψ/memory/handoffs/ — Session handoffs
- ψ/memory/mood/ — Mood tracking
- ψ/memory/traces/ — Deep trace logs
- ψ/memory/pulse/ — Project tasks

External References:
- _ref/skills-cli/ — 55 skills from oracle-skills-cli
- _ref/oracle-v3/ — Memory patterns from oracle-v3
- _ref/maw-js/ — Fleet patterns (empty, patterns already adapted)
- _ref/vault-report/ — Vault patterns (already adapted)
- _ref/workflow-kit/ — Workflow patterns
- _ref/claude-code-statusline/ — Statusline patterns

E2E Tests:
- test/e2e.mjs — 23/23 tests passed

Docs:
- docs/DEPLOY.md — VPS deploy guide (systemd, Docker, Nginx)
- docs/HOW-TO-ADD-AGENTS.md — How to add agents

════════
วิธีรัน
════════

git pull origin main
npm install
npx tsx src/index.ts
# เปิด http://localhost:3456

════════
วิธีเทส
════════

# เริ่ม server ก่อน
npx tsx src/index.ts

# แล้วรันเทส (อีก terminal)
npx tsx test/e2e.mjs

════════
วิธีอัพขึ้น GitHub
════════

git add -A
git commit -m "descriptive message"
git remote set-url origin https://dmz2001TH:TOKEN@github.com/dmz2001TH/oracle-multi-agent.git
git push origin main
git remote set-url origin https://github.com/dmz2001TH/oracle-multi-agent.git

TOKEN = ถามเจ้าของโปรเจ็ค อย่า commit token ลง repo

════════
สไตล์การทำงานกับเจ้าของโปรเจ็ค
════════

- คุยภาษาไทย ตอบภาษาไทย
- สั้น ตรง ไม่อ้อมค้อม ทำเลยไม่ต้องถามเยอะ
- แก้เสร็จ → commit + push ทุกครั้ง
- ส่งคำสั่ง git pull + restart ให้เจ้าของทำตาม
- Token จะส่งทาง chat ตอน push อย่า commit ลง repo
- เจ้าของดูผลที่ http://localhost:3456

════════
สำคัญ
════════

- ทำเสร็จแล้ว commit + push ทุกครั้ง + อัพ HANDOFF.md ด้วย
- ถ้า TypeScript compile error → แก้ก่อน commit
- หลักการ: "Nothing is Deleted" — ไม่ลบโค้ดเก่า แต่ปรับปรุงแทน
- Dashboard = public/index.html (static HTML) — แก้ไขที่นี่โดยตรง
- WebSocket path ต้องเป็น /ws
- มี API routers หลายตัว — ระวัง route ชนกัน
- อย่า commit token ลง repo
- รัน E2E tests ก่อน push ทุกครั้ง: npx tsx test/e2e.mjs
```
