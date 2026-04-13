# HANDOFF — oracle-multi-agent v5.0 Testing & Hardening

## สถานะปัจจุบัน (2026-04-14 03:49 GMT+8)

**33 commands | 40+ API endpoints | 25 _ref repos**
TypeScript: 0 errors

### เพิ่มเติมจาก session ล่าสุด:
- 33 CLI Commands (16 original + 7 new tools + /oracle-v2 bridge + 10 maw-js agent mgmt)
- Agent system prompts with CLI command awareness
- /learn รองรับ GitHub org URL
- ψ/ full oracle-framework structure
- Oracle-v2 bridge API (/api/oracle-v2/*)
- 25 _ref repos from Soul-Brews-Studio + the-oracle-keeps-the-human-human

### How to Run
```bash
git pull origin main && npm install && npx tsx src/index.ts
# http://localhost:3456
```

### How to Test
```bash
npx tsx src/index.ts &
npx tsx test/e2e.mjs
```

### All 33 CLI Commands
```
Core (16): /help, /awaken, /recap, /fyi, /rrr, /standup, /feel, /forward, /trace, /learn, /who-are-you, /philosophy, /skills, /resonance
Tools (7): /fleet, /pulse, /workflow, /distill, /inbox, /overview, /find, /soul-sync, /contacts
System (1): /oracle-v2
Agent Mgmt (10): /ls, /peek, /hey, /wake, /sleep, /stop, /done, /broadcast, /bud, /restart
```

### Agent Roles (9)
general, researcher, coder, writer, manager, data-analyst, devops, qa-tester, translator
ทุก role มี CLI command awareness

### _ref/ Repos (25)
See README.md for full list

### Known Issues
- Federation peer-to-peer: ต้อง 2+ nodes ทดสอบจริง
- WASM Plugin Runtime: Book Ch11, ยังไม่ได้ implement
- Oracle-v2: ต้องรันแยก (`cd _ref/oracle-v2 && bun src/server.ts`)
