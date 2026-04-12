# Soul-Brews-Studio Analysis — Key Learnings Applied

## สิ่งที่เรียนรู้จาก Oracle Architecture

### 1. "Nothing is Deleted" — Supersede Pattern
Oracle ไม่ลบข้อมูลเก่า แต่ mark เป็น superseded:
- `oracle_documents.superseded_by` → ID ของเอกสารใหม่
- `supersede_log` → audit trail เก็บทุกการเปลี่ยนแปลง
- old document ยังอยู่ แต่ถูกติดธงว่า outdated

**ที่เราขาด**: เราแค่อัพเดท memory ตรงๆ ไม่มี version history

### 2. Threaded Discussions (Forum Pattern)
Oracle ใช้ `forum_threads` + `forum_messages` แทน flat channels:
- thread มี status: active, answered, pending, closed
- message มี role: human, oracle, claude
- เชื่อมกับ GitHub Issues ได้

**ที่เราขาด**: เรามีแค่ flat messages channel ไม่มี thread

### 3. Trace System (Hierarchical)
Oracle มี trace system ที่ซับซ้อนมาก:
- `trace_log` เก็บ discovery sessions
- dig points: files, commits, issues, retrospectives
- hierarchical: parent_trace / child_trace
- linked list: prev_trace / next_trace (chain)
- distillation: raw → reviewed → distilled

**ที่เราขาด**: ไม่มี trace เลย

### 4. Analytics Logging
Oracle เก็บ log ทุกอย่าง:
- `search_log` — query, results, search time
- `learn_log` — pattern, source, concepts
- `document_access` — who accessed what, when

**ที่เราขาด**: ไม่มี analytics เลย

### 5. Process Lifecycle Management
Oracle มี PID file management:
- write PID file on start
- graceful shutdown with resource cleanup
- signal handlers (SIGINT, SIGTERM)

**ที่เราขาด**: kill ตรงๆ ไม่มี graceful shutdown

### 6. Security
Oracle มี:
- CORS with origin validation (not just `*`)
- Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- Auth routes
- Read-only mode

**ที่เราขาด**: ไม่มี security เลย

### 7. Tool Groups Config
Oracle สามารถ enable/disable tools ได้:
- `tool-groups.ts` config
- read-only mode disables write tools
- disabled tools return proper error messages

**ที่เราขาด**: ไม่มี config system

### 8. Transport Abstraction (maw-js)
maw-js ใช้ Transport interface:
- TmuxTransport (local)
- HTTP transport (remote)
- SSH transport (remote)
- Clean interface: send(), connect(), disconnect(), canReach()

**ที่เราขาด**: ผูกกับ API อย่างเดียว
