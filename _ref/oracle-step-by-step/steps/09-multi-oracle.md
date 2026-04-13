# Step 9: Multi-Oracle Setup

> หลาย Oracle ในเครื่องเดียว — ทำงานพร้อมกัน ไม่ชนกัน

## ความท้าทาย

เมื่อ run หลาย Oracle ต้องจัดการ:
1. **Port** — แต่ละ Oracle ใช้ port ต่างกัน
2. **Database** — แชร์ root directory แต่แยก DB
3. **Process** — จัดการด้วย tmux

## Architecture

```
~/.oracle/                    ← Shared root
├── oracle.db                 ← Oracle #1 DB (default)
├── oracle-dev.db             ← Oracle #2 DB
├── oracle-qa.db              ← Oracle #3 DB
├── vault/                    ← Shared vault (knowledge flows)
├── feed.log                  ← Shared feed
└── pid/
    ├── default.pid
    ├── dev.pid
    └── qa.pid
```

## Config แต่ละ Oracle

### Oracle #1 (Default) — Port 47778

```bash
# ไม่ต้อง config อะไร — ใช้ default
bun run server
```

### Oracle #2 (Dev) — Port 47779

```bash
# ตั้ง port ผ่าน environment variable
ORACLE_PORT=47779 ORACLE_DB=~/.oracle/oracle-dev.db bun run server
```

### Oracle #3 (QA) — Port 47780

```bash
ORACLE_PORT=47780 ORACLE_DB=~/.oracle/oracle-qa.db bun run server
```

## tmux Setup

```bash
#!/bin/bash
# oracle-fleet.sh — Start all Oracles

SESSION="oracle-fleet"
ORACLE_DIR="/path/to/arra-oracle"

# Kill existing session
tmux kill-session -t $SESSION 2>/dev/null

# Create session with Oracle #1 (default)
tmux new-session -d -s $SESSION -n "oracle-1" \
  "cd $ORACLE_DIR && bun run server"

# Oracle #2 (dev) — port 47779
tmux new-window -t $SESSION -n "oracle-2" \
  "cd $ORACLE_DIR && ORACLE_PORT=47779 ORACLE_DB=~/.oracle/oracle-dev.db bun run server"

# Oracle #3 (qa) — port 47780
tmux new-window -t $SESSION -n "oracle-3" \
  "cd $ORACLE_DIR && ORACLE_PORT=47780 ORACLE_DB=~/.oracle/oracle-qa.db bun run server"

# Oracle Studio — connecting to Oracle #1
tmux new-window -t $SESSION -n "studio" \
  "bunx oracle-studio --port 3000"

echo "Oracle fleet started! tmux attach -t $SESSION"
```

```bash
chmod +x oracle-fleet.sh
./oracle-fleet.sh
tmux attach -t oracle-fleet
```

## MCP Config สำหรับแต่ละ Oracle Repo

แต่ละ Oracle repo มี `.mcp.json` ชี้ไปที่ port ของตัวเอง:

**Oracle #1 (.mcp.json)**:
```json
{
  "mcpServers": {
    "oracle-v2": {
      "command": "bunx",
      "args": ["--bun", "arra-oracle@github:Soul-Brews-Studio/arra-oracle#main"],
      "env": {
        "ORACLE_PORT": "47778"
      }
    }
  }
}
```

**Oracle #2 (.mcp.json)**:
```json
{
  "mcpServers": {
    "oracle-v2": {
      "command": "bunx",
      "args": ["--bun", "arra-oracle@github:Soul-Brews-Studio/arra-oracle#main"],
      "env": {
        "ORACLE_PORT": "47779",
        "ORACLE_DB": "~/.oracle/oracle-dev.db"
      }
    }
  }
}
```

## Oracle Studio กับหลาย Oracles

```bash
# Studio สำหรับ Oracle #1
bunx oracle-studio --api http://localhost:47778 --port 3000

# Studio สำหรับ Oracle #2
bunx oracle-studio --api http://localhost:47779 --port 3001
```

## Shared Knowledge

ข้อดีของ shared `~/.oracle/vault/`:
- Oracle #1 เรียนรู้อะไร → Oracle #2 ค้นหาได้
- Knowledge flows ระหว่าง Oracles

## สิ่งที่ได้

- [x] หลาย Oracle ในเครื่องเดียว — port ไม่ชน
- [x] Database แยก แต่ vault แชร์ได้
- [x] tmux script สำหรับ start fleet
- [x] Oracle Studio เชื่อมแต่ละ Oracle

---

## จบแล้ว!

คุณมี:
1. ✅ Oracle ที่มี identity (CLAUDE.md)
2. ✅ Skills ครบ (/recap, /learn, /rrr)
3. ✅ สมอง (ψ/ vault)
4. ✅ ความทรงจำถาวร (oracle-v2)
5. ✅ Dashboard (Oracle Studio)
6. ✅ สื่อสารได้ (/talk-to, maw hey)
7. ✅ Session lifecycle
8. ✅ Multi-Oracle setup

### สิ่งที่ทำต่อได้

- 📖 [oracle-maw-guide](https://github.com/the-oracle-keeps-the-human-human/oracle-maw-guide) — เรียน maw CLI เต็มรูปแบบ (messaging, fleet, tasks, loops)
- 📖 [oracle-custom-skills](https://github.com/the-oracle-keeps-the-human-human/oracle-custom-skills) — สร้าง skill ของตัวเอง
- สร้าง Oracle ให้ project ต่างๆ
- ทดลอง multi-agent workflow (Dev → QA → Writer)
- สอนคนอื่นสร้าง Oracle ของตัวเอง
- **Oracle สร้าง Oracle — recursion ไม่มีที่สิ้นสุด**

---

*"The highest form of creation is creating creators."*
