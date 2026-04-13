# Step 5: ความทรงจำถาวร — oracle-v2

> oracle-v2 (arra-oracle) คือ memory engine — ทำให้ Oracle search, learn, remember ได้

## oracle-v2 คืออะไร?

- **MCP Server** ที่เชื่อมกับ Claude Code
- **22 tools** สำหรับจัดการ knowledge
- **Hybrid search** — FTS5 (full-text) + vector (semantic)
- **SQLite database** — เก็บ knowledge, threads, traces, schedule

## ติดตั้ง oracle-v2

### วิธีง่ายที่สุด — เพิ่มใน Claude Code

```bash
claude mcp add oracle-v2 -- bunx --bun arra-oracle@github:Soul-Brews-Studio/arra-oracle#main
```

สิ่งนี้จะเพิ่มใน `~/.claude.json`:
```json
{
  "mcpServers": {
    "oracle-v2": {
      "command": "bunx",
      "args": ["--bun", "arra-oracle@github:Soul-Brews-Studio/arra-oracle#main"]
    }
  }
}
```

### วิธี Manual — Clone แล้ว Run

```bash
# Clone
git clone https://github.com/Soul-Brews-Studio/arra-oracle.git
cd arra-oracle && bun install

# Start MCP server (สำหรับ Claude Code)
bun run dev

# Start HTTP server (สำหรับ dashboard)
bun run server    # default port: 47778
```

## Initialize Vault

ครั้งแรกต้อง initialize:

```bash
# ใน Claude Code session
> oracle_search("test")
```

oracle-v2 จะสร้าง `~/.oracle/` directory:
```
~/.oracle/
├── oracle.db          ← SQLite database
├── vault/             ← Knowledge vault
├── feed.log           ← Activity feed
└── pid                ← Process ID
```

## 22 MCP Tools

เมื่อ oracle-v2 ทำงาน จะมี tools เหล่านี้ใน Claude Code:

### Search & Learn
| Tool | ทำอะไร |
|------|--------|
| `oracle_search` | ค้นหา knowledge (hybrid search) |
| `oracle_learn` | เพิ่ม pattern/learning ใหม่ |
| `oracle_reflect` | Semantic reflection — ค้นลึก |
| `oracle_list` | ดู documents ทั้งหมด |
| `oracle_read` | อ่าน document ตาม ID |
| `oracle_concepts` | ดู concept tags |
| `oracle_stats` | สถิติ knowledge base |

### Communication
| Tool | ทำอะไร |
|------|--------|
| `oracle_thread` | สร้าง/ตอบ thread (คุยกับ Oracle อื่น) |
| `oracle_threads` | ดู threads ทั้งหมด |
| `oracle_thread_read` | อ่าน thread |
| `oracle_thread_update` | update thread |

### Session Management
| Tool | ทำอะไร |
|------|--------|
| `oracle_handoff` | สร้าง session handoff |
| `oracle_inbox` | ดู inbox |
| `oracle_supersede` | supersede document เก่า (ไม่ลบ!) |
| `oracle_verify` | verify document |

### Discovery
| Tool | ทำอะไร |
|------|--------|
| `oracle_trace` | เริ่ม trace session |
| `oracle_trace_list` | ดู traces |
| `oracle_trace_get` | อ่าน trace |
| `oracle_trace_link` | link trace กับ dig point |
| `oracle_trace_chain` | ดู chain ของ trace |

### Time
| Tool | ทำอะไร |
|------|--------|
| `oracle_schedule_add` | เพิ่มนัดหมาย |
| `oracle_schedule_list` | ดูตาราง |

## ทดสอบ

```bash
# เปิด Claude Code
claude

# ทดสอบ search
> ค้นหาใน oracle: "philosophy"

# เพิ่ม learning
> จำไว้ว่า: oracle-v2 ใช้ hybrid search — FTS5 สำหรับ keyword, vector สำหรับ semantic

# ค้นหาสิ่งที่เพิ่งเรียน
> ค้นหาใน oracle: "hybrid search"
```

## "Nothing is Deleted"

oracle-v2 ไม่ลบอะไร:
- document เก่า → `oracle_supersede` → mark เป็น superseded
- document ใหม่ point ไปที่เก่า → audit trail
- ทุก version ยังค้นหาได้

## สิ่งที่ได้

- [x] oracle-v2 MCP ทำงาน
- [x] `~/.oracle/` directory พร้อม
- [x] Search + Learn ใช้ได้
- [x] เข้าใจ "Nothing is Deleted"

---

**ถัดไป**: [Step 6: Dashboard — Oracle Studio](06-oracle-studio.md)
