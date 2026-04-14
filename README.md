# 🧠 Oracle Multi-Agent v5.0

AI agents that remember, communicate, and collaborate — built on the Oracle ecosystem.

![MAW Compliant](https://img.shields.io/badge/MAW-Compliant-green) ![LangGraph](https://img.shields.io/badge/LangGraph-Ready-blue) ![PyAgentSpec](https://img.shields.io/badge/PyAgentSpec-Configured-purple)

**Repo**: https://github.com/dmz2001TH/oracle-multi-agent
**Dashboard**: http://localhost:3456
**Version**: 5.0.0 | **Commands**: 44 | **Plugins**: 11 | **API Endpoints**: 50+ | **Dashboard Pages**: 12 | **MCP Tools**: 12 | **Agent Tools**: 11 | **_ref repos**: 25

## Quick Start

```bash
npm install
npm run migrate
npm run start:all
```

Access dashboard at http://localhost:3456/dashboard/index.html

## Dashboard (12 หน้า — ภาษาไทย)

| Route | ทำอะไร |
|-------|--------|
| `/` | หน้าหลัก — รายชื่อเอเจนต์, แชท, สถิติระบบ, คำสั่งทั้งหมด |
| `/chat` | แชท — ChibiAvatars, Bubble/Timeline/Threads views, บันทึกแยกตาม agent |
| `/feed` | Live Feed — เห็นทุกการสื่อสารระหว่าง agent แบบ real-time |
| `/terminal` | เทอร์มินัล — เลือกเอเจนต์, ดู output, พิมพ์คำสั่ง |
| `/mission` | มิชชั่น — Pulse stats, task progress, workflow templates |
| `/inbox` | อินบ็อกซ์ — messages/handoffs/FYI/resonance แบบ filter |
| `/agents` | เอเจนต์ — card grid, spawn, restart/sleep/stop, คุยทีละตัว |
| `/fleet` | ฟลีต — ภาพรวมทั้งหมด, agent grid, health check |
| `/federation` | Federation Mesh — mesh visualization, node health, soul sync |
| `/workspace` | เวิร์คสเปซ — workspace configs, skills, broadcast |
| `/config` | ตั้งค่า — system info, plugins, commands, fleet config |
| `/vault` | ห้องนิรภัย — ψ/ stats, search, skills, 5 หลักการ |
| `/workspace-files/` | File browser — ดูไฟล์ที่ agent สร้าง |

ทุกหน้ามี nav bar เชื่อมถึงกัน

## CLI Commands (44 ตัว)

ส่งผ่าน: `POST /api/commands/execute {"input": "/command args"}`
หรือพิมพ์ใน chat ของ dashboard (WebSocket)

### Core (16)
| Command | ทำอะไร |
|---------|--------|
| `/help` | แสดงคำสั่งทั้งหมด |
| `/awaken` | ตั้งค่า identity (`ชื่อ\|ธาตุ\|บทบาท\|สโลแกน`) |
| `/recap` | สรุป session ย้อนหลัง (1-30 วัน) |
| `/fyi` | บันทึกข้อมูลลง memory + ψ/ |
| `/rrr` | Retrospective รายวัน (`good: X \| improve: Y \| action: Z`) |
| `/standup` | Daily standup (`yesterday: X \| today: Y \| blocker: Z`) |
| `/feel` | บันทึกอารมณ์ |
| `/forward` | สร้าง session handoff |
| `/trace` | ค้นหา memory + code (`--deep`, `--oracle`) |
| `/learn` | วิเคราะห์ repository (รองรับ GitHub org URL) |
| `/who-are-you` | แสดง identity + stats |
| `/philosophy` | 5 หลักการ Oracle + Rule 6 |
| `/skills` | แสดง/ค้น 55 skills |
| `/resonance` | บันทึก moment ที่ resonate |
| `/fleet` | ตรวจนับ agents + nodes |
| `/pulse` | Project board (`add/done/list`) |

### Tools (7)
| Command | ทำอะไร |
|---------|--------|
| `/workflow` | เทมเพลต workflow |
| `/distill` | ดึง patterns จาก journal |
| `/inbox` | เช็คอินบ็อกซ์ |
| `/overview` | ภาพรวมระบบ |
| `/find` | ค้น memory เร็ว |
| `/soul-sync` | ซิงค์ ψ/ ↔ ~/.oracle/ |
| `/contacts` | แสดงรายชื่อ contacts |

### Agent Management (10)
| Command | ทำอะไร |
|---------|--------|
| `/ls` | แสดง agents ทั้งหมด |
| `/peek` | ดู output ล่าสุด |
| `/hey` | ส่งข้อความให้ agent |
| `/wake` | สร้าง/ปลุก agent |
| `/sleep` | หยุด agent อย่างนุ่มนวล |
| `/stop` | บังคับหยุด agent |
| `/done` | save state + หยุด agent |
| `/broadcast` | ส่งข้อความให้ทุก agents |
| `/bud` | สร้าง oracle จาก parent |
| `/restart` | รีสตาร์ท agent |

### maw-js Parity (11)
| Command | ทำอะไร |
|---------|--------|
| `/plugin` | จัดการ plugins (`list/install/remove`) |
| `/task` | ระบบ task (`log --commit/--blocker`, `show`, `comment`, `done`) |
| `/project` | Project trees (`create`, `add`, `show`) |
| `/loop` | จัดการ loop (`add/remove/trigger/enable/disable`) |
| `/tokens` | ดู token usage (`--rebuild`, `--json`) |
| `/think` | Think cycle — ให้ agents เสนอ ideas |
| `/meeting` | ประชุม — รวบรวม input (`--dry-run`) |
| `/tab` | จัดการ tabs (`list/send`) |
| `/view` | ดู agent เต็มหน้าจอ (`--clean`) |
| `/chat` | ดู chat history ต่อ agent |
| `/review` | ดูผล think cycle proposals |

### System
| Command | ทำอะไร |
|---------|--------|
| `/oracle-v2` | Oracle-v2 MCP server bridge (port 47778) |

## Plugins (11 ตัว — load ได้จริง)

| Weight | Plugin | ทำอะไร |
|--------|--------|--------|
| 00 | `wake` | สร้าง/ปลุก agent |
| 00 | `sleep` | หยุด agent |
| 00 | `hey` | ส่งข้อความ (alias: `talk-to`) |
| 00 | `ls` | แสดง agents (alias: `oracle`) |
| 20 | `ping` | Ping server health |
| 20 | `health` | ตรวจสุขภาพระบบ |
| 20 | `status` | สถานะด่วน (alias: `st`) |
| 50 | `bud` | สร้าง oracle จาก parent |
| 50 | `about` | ข้อมูลละเอียด |
| 50 | `contacts` | รายชื่อ contacts |
| 50 | `research-swarm` | 🐝 วิจัยแบบทีม (spawn N agents พร้อมกัน) |

### สร้าง Plugin ใหม่

```
plugins/
  50-my-plugin/
    plugin.json   ← manifest (name, version, weight, surfaces)
    index.ts      ← handler(ctx) → InvokeResult
```

```ts
// index.ts
import { definePlugin } from "../../src/plugins/sdk.js";

export default definePlugin({
  name: "my-plugin",
  async handler(ctx) {
    if (ctx.source === "cli") return { ok: true, output: "Hello!" };
    return { ok: true, data: { hello: true } };
  },
});
```

## API Endpoints (50+)

### Core
- `GET /health` — Health check
- `GET /api/commands` — List CLI commands
- `POST /api/commands/execute` — Execute CLI command

### Agents (v2)
- `GET /api/v2/agents` — List agents
- `POST /api/v2/agents/spawn` — Spawn agent
- `POST /api/v2/agents/:id/chat` — Chat with agent
- `DELETE /api/v2/agents/:id` — Stop agent
- `POST /api/v2/agents/broadcast` — Broadcast

### Memory & Skills
- `GET /api/v2/memory/search?q=X` — Search memory
- `GET /api/v2/memory/stats` — Memory statistics
- `GET /api/skills` — List/search skills
- `GET /api/vault/stats` — ψ/ statistics

### Oracle-v2 Bridge
- `GET /api/oracle-v2/status` — Check oracle-v2
- `GET /api/oracle-v2/search` — Search KB
- `POST /api/oracle-v2/learn` — Add knowledge
- (+ 10 more endpoints)

### Federation Mesh (NEW)
- `GET /api/federation/status` — Federation peer status
- `GET /api/federation/mesh` — Full mesh topology
- `POST /api/federation/broadcast` — Broadcast to all peers
- `POST /api/soul-sync` — Sync memory between peers
- `POST /api/peer/exec` — Remote command execution (HMAC-SHA256 signed)
- `GET /api/peer/exec` — Session diagnostics

### MCP Bridge (NEW)
- `POST /api/mcp` — JSON-RPC 2.0 MCP endpoint
- `GET /api/mcp/tools` — List 12 MCP tools
- `GET /api/mcp/status` — MCP bridge status

### Autonomous Orchestrator (NEW)
- `POST /api/orchestrator/goal` — Create goal + auto-decompose
- `POST /api/orchestrator/tick` — Run one orchestration cycle
- `GET /api/orchestrator/status` — Orchestrator stats
- `GET /api/orchestrator/goals` — List all goals
- `GET /api/orchestrator/advice` — Get AI advice for task

### Legacy
- `/api/tasks`, `/api/inbox`, `/api/workflows`, `/api/loops`, `/api/projects`, `/api/cron`, `/api/federation`, `/api/logs`, `/api/costs`, etc.

## Agent Tools (11 ตัว — agent ใช้ได้จริง)

| Tool | ทำอะไร |
|------|--------|
| `remember` | บันทึกความจำลง memory |
| `search_memory` | ค้นหาความจำ |
| `tell` | ส่งข้อความหา agent อื่น |
| `list_agents` | ดู agent ทั้งหมด |
| `create_task` | สร้าง task |
| `read_file` | อ่านไฟล์ source code |
| `write_file` | เขียน/สร้างไฟล์ (อยู่ที่ ~/.oracle/) |
| `call_api` | เรียก API ใดๆ |
| `query_data` | ค้น goals/tasks/experiences |
| `get_messages` | เช็คข้อความจาก agent อื่น |
| `spawn_agent` | สร้าง agent ใหม่ |

ดูผลงาน agent ได้ที่: `http://localhost:3456/workspace-files/`

## Agent Roles (9)

| Role | ทำอะไร |
|------|--------|
| `general` | ผู้ช่วยทั่วไป (command-aware) |
| `researcher` | วิเคราะห์, ค้นหา patterns |
| `coder` | เขียน/แก้/debug code |
| `writer` | เอกสาร, รายงาน, content |
| `manager` | ประสานงาน, มอบหมาย |
| `data-analyst` | วิเคราะห์ข้อมูล, สถิติ |
| `devops` | deploy, monitoring, infra |
| `qa-tester` | ทดสอบ, หาบั๊ค |
| `translator` | แปลภาษา, i18n |

## Oracle 5 Principles (รูปสอนสุญญตา)

1. **สร้างใหม่ ไม่ลบ** — Nothing is Deleted
2. **ดูสิ่งที่เกิดขึ้นจริง** — Patterns Over Intentions
3. **เป็นกระจก ไม่ใช่เจ้านาย** — External Brain, Not Command
4. **ความอยากรู้สร้างการมีอยู่** — Curiosity Creates Existence
5. **รูป และ สุญญตา** — Form and Formless

Rule 6: ความโปร่งใส — "Oracle ไม่แกล้งทำเป็นคน"

Source: https://book.buildwithoracle.com

## วิธีเทส

```bash
# Terminal 1: Start server
npx tsx src/index.ts

# Terminal 2: Test
curl -s http://localhost:3456/health
curl -s -X POST http://localhost:3456/api/commands/execute \
  -H 'Content-Type: application/json' \
  -d '{"input":"/help"}'
```

## วิธี Push

```bash
git add -A && git commit -m "message"
git remote set-url origin https://dmz2001TH:TOKEN@github.com/dmz2001TH/oracle-multi-agent.git
git push origin main
git remote set-url origin https://github.com/dmz2001TH/oracle-multi-agent.git
```

## License

MIT
