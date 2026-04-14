# HANDOFF — 2026-04-14 15:00 GMT+8

## สิ่งที่ทำเสร็จแล้ว ✅

### 1. 10 Features ที่ขาดจาก Soul Brews Studio ecosystem (commit 5039459)
แต่ละ feature มี source module + API route + test suite (49 tests ผ่านหมด)

| # | Feature | Path | Status |
|---|---------|------|--------|
| 1 | Mailbox System (Tier 2) | `src/mailbox/index.ts` | ✅ Done |
| 2 | Agent Lineage (Yeast Model) | `src/lineage/index.ts` | ✅ Done |
| 3 | Session-End Archival | `src/archive/index.ts` | ✅ Done |
| 4 | Hybrid Search (BM25 + Vector) | `src/hybrid-search/index.ts` | ✅ Done |
| 5 | WASM Plugin Runtime | `src/wasm-runtime/index.ts` | ✅ Done |
| 6 | Standing Orders | `src/standing-orders/index.ts` | ✅ Done |
| 7 | Research Swarm | `src/swarm/index.ts` | ✅ Done |
| 8 | Fleet Oracle Scan | `src/fleet-scan/index.ts` | ✅ Done |
| 9 | Cost Model by Tier | `src/cost-model/index.ts` | ✅ Done |
| 10 | WireGuard P2P | `src/wireguard/index.ts` | ✅ Done |

Test file: `test/test-10-features.mjs`

### 2. Agent Natural Language Fix (commit 6e550f1)
- Rewrote all 10 agent system prompts in `src/agents/manager.js` to Thai
- Agents now **ACT** instead of telling users to type commands
- Fixed greeting message in `public/index.html`
- Fixed command responses in `src/commands/index.ts` to be concise

## สิ่งที่ยังไม่เสร็จ ❌ (ให้ agent ตัวถัดไปทำ)

### Priority 1: Wire API routes เข้า main router
- `src/api/index.ts` ยังไม่ได้ import route ใหม่ 9 ไฟล์:
  - mailbox-api, lineage-api, archive-api, swarm-api
  - fleet-scan-api, cost-model-api, standing-orders-api
  - hybrid-search-api, wireguard-api

### Priority 2: Wire CLI commands เข้า command registry
- `src/commands/index.ts` ยังไม่มี handler สำหรับ:
  - /mailbox, /lineage, /archive, /swarm, /fleet-scan
  - /cost, /standing-orders, /search (hybrid)

### Priority 3: เชื่อม agent prompts กับ new features
- Agent ควรใช้ mailbox system เมื่อสื่อสารกับ agent อื่น
- Agent ควรใช้ standing orders
- Agent ควรใช้ hybrid search แทน linear search

### Priority 4: เพิ่ม WASM plugin loading จริง
- ตอนนี้ WASM runtime เป็น interface contract ยังไม่ได้ load .wasm จริง

### Priority 5: Test integration กับ server จริง
- `test/test-10-features.mjs` เป็น unit test ยังไม่ได้ test กับ running server
- ต้อง test API endpoints จริง

## Source ที่ใช้เรียนรู้
- https://soul-brews-studio.github.io/multi-agent-orchestration-book/
- https://github.com/the-oracle-keeps-the-human-human/oracle-maw-guide
- https://github.com/Soul-Brews-Studio/ (maw-js, oracle-framework, agents-that-remember, the-agent-bus, arra-oracle-v3, arra-oracle-skills-cli, shrimp-oracle)

## ⚠️ Security
- GitHub PAT (`ghp_Dm6B...`) อยู่ใน git remote URL — **ต้อง revoke ทันที**
- Token ใช้ clone + push เท่านั้น ลบออกจาก remote แล้ว
