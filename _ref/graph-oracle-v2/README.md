---

# Graph Oracle

## สมองกลางที่เชื่อมความรู้ทุก Oracle | Central brain connecting all Oracle knowledge

> "ทุก Oracle รู้เรื่องของตัวเอง แต่ Graph Oracle เห็นภาพรวมทั้งหมด"
>
> "Every Oracle knows its own domain, but Graph Oracle sees the big picture."

---

## What is this? | นี่คืออะไร?

**TH:** Graph Oracle ดึงความรู้จาก Oracle ทั้ง 26 ตัว สร้างเป็น knowledge graph แล้วค้นหาความเชื่อมโยงที่ไม่มีใครเห็น เช่น Cyber พบปัญหาที่ Backend เคยแก้แล้ว → Graph Oracle จะบอกให้

**EN:** Graph Oracle harvests knowledge from all 26 Oracles, builds a knowledge graph, and discovers hidden connections across domains. For example, if Cyber finds a problem that Backend already solved → Graph Oracle will tell them.

```
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Wisdom  │  │  Cyber  │  │ Backend │  ...26 Oracles
└────┬────┘  └────┬────┘  └────┬────┘
     │            │            │
     └────────────┼────────────┘
                  ▼
          ┌──────────────┐
          │ Graph Oracle │  ← harvest ความรู้ทั้งหมด
          │  :47792      │  ← สร้าง knowledge graph
          └──────┬───────┘  ← ค้นหา connections
                 │
                 ▼
          ┌──────────────┐
          │  Discoveries │  → รายงานกลับไป Oracle ที่เกี่ยวข้อง
          └──────────────┘
```

---

## Quick Start | เริ่มต้นใช้งาน

### Prerequisites | สิ่งที่ต้องมี

```bash
# ต้องติดตั้งก่อน | Install these first:
bun --version    # ต้องมี Bun ≥ 1.2 | Need Bun ≥ 1.2
tmux -V          # ต้องมี tmux      | Need tmux

# Oracle Fleet ต้องรันอยู่ | Oracle Fleet must be running:
./oracle           # เปิด fleet | Start fleet
./oracle status    # เช็คว่า Oracle ออนไลน์ | Check Oracles are online
```

### Install | ติดตั้ง

```bash
cd graph
bun install
```

### 3 Commands You Need | 3 คำสั่งที่ต้องรู้

```bash
# 1. เปิด server | Start the server
bun run server
# → Graph Oracle running at http://localhost:47792

# 2. ดึงความรู้จากทุก Oracle | Harvest knowledge from all Oracles
bun run cli harvest
# → Harvesting from wisdom... 142 nodes, 89 edges
# → Harvesting from cyber...  98 nodes, 67 edges
# → ...
# → Total: 1,247 nodes, 834 edges

# 3. ค้นหา discoveries | Find cross-Oracle discoveries
bun run cli discover
# → Found 3 bridges, 2 chains, 1 cluster
# → Top discovery: "authentication" connects 5 Oracles (score: 8.2)
```

---

## All Commands | คำสั่งทั้งหมด

### Server | เซิร์ฟเวอร์

```bash
# เปิด server | Start server
bun run server

# เปิดแบบกำหนด port | Start with custom port
GRAPH_PORT=47792 bun run server
```

### Harvest | ดึงข้อมูล

```bash
# ดึงจากทุก Oracle ที่ออนไลน์ | Harvest from all online Oracles
bun run cli harvest

# ดึงจาก Oracle เฉพาะตัว | Harvest from specific Oracle
bun run cli harvest --oracle=cyber

# ดึงเฉพาะที่เปลี่ยนแปลง (เร็วกว่า) | Incremental harvest (faster)
bun run cli harvest --incremental
```

**เบื้องหลัง | What happens:**
1. เรียก `/api/fleet` เพื่อหาว่า Oracle ไหนออนไลน์
2. เรียก `/api/list` ของแต่ละ Oracle เพื่อดึง documents
3. Parse concepts จากทุก document
4. สร้าง nodes (documents + concepts + oracle identities)
5. สร้าง edges (SHARES_CONCEPT, BELONGS_TO, RELATES_TO)
6. บันทึกใน SQLite

### Discover | ค้นหาความเชื่อมโยง

```bash
# ค้นหาทุกประเภท | Run all discovery types
bun run cli discover

# ค้นหาเฉพาะ bridges | Find only cross-domain bridges
bun run cli discover --type=bridges

# ค้นหาเฉพาะ chains | Find only multi-hop chains
bun run cli discover --type=chains

# ค้นหาเฉพาะ clusters | Find only concept clusters
bun run cli discover --type=clusters

# กำหนดคะแนนขั้นต่ำ | Set minimum score
bun run cli discover --min-score=7.0
```

**ประเภท Discovery | Discovery Types:**

| Type | TH | EN | Example |
|---|---|---|---|
| `bridge` | สะพานข้ามโดเมน | Cross-domain bridge | Concept "caching" เชื่อม Backend กับ Frontend |
| `chain` | เส้นทางหลายขั้น | Multi-hop chain | Cyber → concept → Backend → concept → QA |
| `cluster` | กลุ่มที่ทำเรื่องเดียวกัน | Concept cluster | 5 Oracles ทำเรื่อง "authentication" |

### Query | สอบถาม graph

```bash
# ดูสถิติ | View stats
bun run cli stats

# ค้นหา nodes | Search nodes
bun run cli search "authentication"

# ดู bridges | List bridges
bun run cli bridges

# Traverse จาก node | Traverse from a node
bun run cli traverse --from=<node_id> --depth=3
```

### Report | รายงานกลับ

```bash
# รายงาน discovery กลับไป Oracle ที่เกี่ยวข้อง | Report discovery to relevant Oracles
bun run cli report --id=<discovery_id>

# ดู discoveries ที่ยังไม่ได้รายงาน | List unreported discoveries
bun run cli discoveries --status=verified
```

**เบื้องหลัง | What happens:**
1. อ่าน discovery จาก DB
2. หา Oracle ที่เกี่ยวข้องจาก `source_oracles`
3. ส่ง task ผ่าน `/api/delegate` ไปยังแต่ละ Oracle
4. อัพเดท discovery status เป็น `reported`

---

## API Reference | คู่มือ API

### Base URL

```
http://localhost:47792
```

### Endpoints

#### Health Check

```bash
# เช็คว่า Graph Oracle ทำงานอยู่ | Check if running
curl http://localhost:47792/api/health
```

```json
{ "status": "ok", "server": "graph-oracle", "port": 47792 }
```

#### Graph Stats | สถิติ

```bash
curl http://localhost:47792/api/graph/stats
```

```json
{
  "nodes": 1247,
  "edges": 834,
  "discoveries": 6,
  "oracles_harvested": 4,
  "last_harvest": "2026-03-29T10:30:00Z",
  "metrics": {
    "connectivity": 0.82,
    "orphan_rate": 0.03,
    "cross_domain_links": 156
  }
}
```

#### List Nodes | ดู nodes

```bash
# ทั้งหมด | All nodes
curl http://localhost:47792/api/graph/nodes

# Filter ตาม Oracle | Filter by Oracle
curl http://localhost:47792/api/graph/nodes?oracle=cyber

# Filter ตาม type | Filter by type
curl http://localhost:47792/api/graph/nodes?label=concept

# ค้นหา | Search
curl http://localhost:47792/api/graph/nodes?q=authentication

# จำกัดจำนวน | Limit results
curl http://localhost:47792/api/graph/nodes?limit=20&offset=0
```

```json
{
  "nodes": [
    {
      "id": "cyber:doc_abc123",
      "label": "learning",
      "name": "SQL injection prevention patterns",
      "oracle_source": "cyber",
      "domain": "quality",
      "properties": { "concepts": ["security", "sql", "validation"] },
      "created_at": 1774785927514
    }
  ],
  "total": 142
}
```

#### Get Node + Edges | ดู node พร้อม edges

```bash
curl http://localhost:47792/api/graph/nodes/cyber:doc_abc123
```

```json
{
  "node": { "id": "cyber:doc_abc123", "label": "learning", "..." },
  "edges": [
    {
      "source_id": "cyber:doc_abc123",
      "target_id": "concept:validation",
      "rel_type": "SHARES_CONCEPT",
      "weight": 0.9,
      "confidence": 0.85
    }
  ],
  "connected_nodes": [
    { "id": "concept:validation", "label": "concept", "name": "validation" },
    { "id": "backend:doc_xyz789", "label": "learning", "name": "Input validation middleware" }
  ]
}
```

#### Cross-Oracle Bridges | สะพานข้ามโดเมน

```bash
curl http://localhost:47792/api/graph/bridges
```

```json
{
  "bridges": [
    {
      "concept": "authentication",
      "oracles": ["cyber", "backend", "frontend", "mobile", "cloud"],
      "edge_count": 12,
      "confidence_avg": 0.78,
      "impact": {
        "depth_1": ["cyber", "backend"],
        "depth_2": ["frontend", "mobile"],
        "depth_3": ["cloud"]
      }
    }
  ],
  "total": 8
}
```

#### Multi-hop Traversal | สำรวจหลายขั้น

```bash
# Traverse 3 ขั้นจาก node | 3-hop traversal from node
curl "http://localhost:47792/api/graph/traverse?from=cyber:doc_abc&depth=3"

# เฉพาะข้ามโดเมน | Cross-domain only
curl "http://localhost:47792/api/graph/traverse?from=cyber:doc_abc&depth=3&cross_domain=true"

# กำหนด confidence ขั้นต่ำ | Minimum confidence
curl "http://localhost:47792/api/graph/traverse?from=cyber:doc_abc&depth=3&min_confidence=0.6"
```

```json
{
  "paths": [
    {
      "nodes": ["cyber:doc_abc", "concept:validation", "backend:doc_xyz"],
      "depth": 2,
      "total_weight": 1.7,
      "domains_crossed": ["quality", "engineering"],
      "confidence_min": 0.75
    }
  ],
  "total_paths": 5
}
```

#### Discoveries | สิ่งที่ค้นพบ

```bash
# ทั้งหมด | All discoveries
curl http://localhost:47792/api/graph/discoveries

# Filter ตามคะแนนขั้นต่ำ | Filter by minimum score
curl "http://localhost:47792/api/graph/discoveries?min_score=7.0"

# Filter ตามประเภท | Filter by type
curl "http://localhost:47792/api/graph/discoveries?type=bridge"

# Filter ตามสถานะ | Filter by status
curl "http://localhost:47792/api/graph/discoveries?status=verified"
```

```json
{
  "discoveries": [
    {
      "id": "disc_abc123",
      "discovery_type": "bridge",
      "title": "authentication connects 5 Oracles across 3 departments",
      "description": "The concept 'authentication' appears in cyber (security patterns), backend (middleware), frontend (login flow), mobile (biometrics), and cloud (IAM). Each Oracle has independent learnings that could benefit the others.",
      "source_oracles": ["cyber", "backend", "frontend", "mobile", "cloud"],
      "path": ["cyber:doc_1", "concept:auth", "backend:doc_2", "concept:session", "frontend:doc_3"],
      "scores": {
        "novelty": 7.5,
        "feasibility": 9.0,
        "impact": 8.5,
        "cross_domain": 9.0,
        "specificity": 6.5
      },
      "composite_score": 8.12,
      "status": "verified",
      "impact_radius": {
        "depth_1_will_benefit": ["cyber", "backend"],
        "depth_2_likely_relevant": ["frontend", "mobile"],
        "depth_3_may_interest": ["cloud"]
      },
      "created_at": 1774786000000
    }
  ],
  "total": 6
}
```

#### Trigger Harvest | สั่ง harvest

```bash
# Harvest ทุก Oracle | Harvest all
curl -X POST http://localhost:47792/api/graph/harvest

# Harvest เฉพาะตัว | Harvest specific Oracle
curl -X POST http://localhost:47792/api/graph/harvest \
  -H "Content-Type: application/json" \
  -d '{"oracle": "cyber"}'
```

#### Trigger Discovery | สั่งค้นหา

```bash
curl -X POST http://localhost:47792/api/graph/discover
```

```json
{
  "bridges_found": 3,
  "chains_found": 2,
  "clusters_found": 1,
  "total_discoveries": 6,
  "top_score": 8.12,
  "duration_ms": 450
}
```

#### Communities (Leiden) | กลุ่ม

```bash
curl http://localhost:47792/api/graph/communities
```

```json
{
  "communities": [
    {
      "id": 1,
      "label": "Authentication & Security",
      "oracles": ["cyber", "backend", "frontend"],
      "concepts": ["authentication", "session", "token", "oauth"],
      "cohesion": 0.82,
      "node_count": 15
    }
  ],
  "total": 4
}
```

---

## Architecture | สถาปัตยกรรม

### Tech Stack | เทคโนโลยีที่ใช้

| Component | Technology | Why |
|---|---|---|
| Runtime | Bun | เร็ว, เหมือนกับ Oracle ตัวอื่น |
| HTTP Server | Hono.js | เบา, เหมือนกับ arra-oracle |
| Database | SQLite + Drizzle ORM | Zero-cost, ไม่ต้อง install อะไรเพิ่ม |
| Graph Queries | SQLite Recursive CTEs | Multi-hop traversal ไม่ต้องใช้ Neo4j |
| Clustering | Leiden Algorithm | จับกลุ่ม concepts ข้าม Oracles |
| Search Merge | RRF (Reciprocal Rank Fusion) | รวมผลจากหลาย Oracles อย่างถูกต้อง |

### Database Tables | ตารางฐานข้อมูล

```
┌─────────────────┐     ┌──────────────────┐
│   graph_nodes   │────→│   graph_edges    │
│                 │     │                  │
│ id (PK)         │     │ source_id (FK)   │
│ label           │     │ target_id (FK)   │
│ name            │     │ rel_type         │
│ oracle_source   │     │ weight           │
│ domain          │     │ confidence       │
│ properties JSON │     │ properties JSON  │
└─────────────────┘     └──────────────────┘

┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  discoveries    │     │  harvest_log     │     │  graph_metrics   │
│                 │     │                  │     │                  │
│ id (PK)         │     │ oracle_name      │     │ node_count       │
│ discovery_type  │     │ nodes_harvested  │     │ edge_count       │
│ title           │     │ edges_created    │     │ connectivity     │
│ scores (5D)     │     │ status           │     │ orphan_rate      │
│ composite_score │     │ started_at       │     │ cross_domain_links│
│ impact_radius   │     │ completed_at     │     │ measured_at      │
│ status          │     │                  │     │                  │
└─────────────────┘     └──────────────────┘     └──────────────────┘
```

### How Discovery Works | การค้นหาทำงานอย่างไร

```
Step 1: Harvest
  ดึงข้อมูลจากทุก Oracle → สร้าง nodes + edges
  Fetch data from all Oracles → create nodes + edges

Step 2: Tier 1 — Keyword Match
  หา nodes ที่มี concept เดียวกัน
  Find nodes sharing the same concepts

Step 3: Tier 2 — Neighborhood (1-2 hops)
  ขยายออก 1-2 ขั้น ดูว่ามีอะไรเชื่อมกัน
  Expand 1-2 hops to find nearby connections

Step 4: Tier 3 — Cross-Domain Bridges
  หา concept ที่เชื่อม Oracle ต่างแผนก
  Find concepts bridging different Oracle departments

Step 5: Tier 4 — Deep Chains (3-4 hops)
  สำรวจ 3-4 ขั้น ข้ามหลายโดเมน
  Traverse 3-4 hops across multiple domains

Step 6: Score (5 dimensions)
  ให้คะแนน: novelty, feasibility, impact, cross_domain, specificity
  Score each discovery on 5 dimensions

Step 7: Impact Analysis
  วัดผลกระทบ: depth 1/2/3
  Measure blast radius: depth 1 (direct), 2 (likely), 3 (possible)

Step 8: Report
  รายงานกลับไป Oracle ที่เกี่ยวข้องผ่าน /api/delegate
  Report back to relevant Oracles via task delegation
```

### Scoring System | ระบบคะแนน

แต่ละ discovery ได้คะแนน 5 มิติ (0-10):
Each discovery is scored on 5 dimensions (0-10):

| Dimension | Weight | TH | EN |
|---|---|---|---|
| Novelty | 25% | ใหม่แค่ไหน — ยิ่ง path ยาว ยิ่งใหม่ | How novel — longer paths = more novel |
| Feasibility | 20% | ทำได้จริงไหม — nodes ที่ connected ดี = ทำได้ | How feasible — well-connected nodes = doable |
| Impact | 25% | กระทบมากไหม — ยิ่งหลาย Oracle ยิ่งกระทบ | How impactful — more Oracles = bigger impact |
| Cross-domain | 20% | ข้ามโดเมนไหม — ยิ่งต่างแผนก ยิ่งดี | How cross-domain — different departments = better |
| Specificity | 10% | เฉพาะเจาะจงไหม — ไม่ซ้ำกับ discovery อื่น | How specific — unique vs similar discoveries |

**Composite Score** = (novelty × 0.25) + (feasibility × 0.20) + (impact × 0.25) + (cross_domain × 0.20) + (specificity × 0.10)

**เกณฑ์ | Thresholds:**
- ≥ 8.0 → S-tier: ต้องรายงานทันที | Report immediately
- ≥ 7.0 → A-tier: ควรรายงาน | Should report
- ≥ 6.0 → B-tier: น่าสนใจ | Interesting
- < 6.0 → C-tier: เก็บไว้ก่อน | Keep for reference

### Edge Confidence | ความมั่นใจของ Edges

| Condition | Confidence | TH |
|---|---|---|
| Exact same concept text | 0.95 | concept เดียวกันเป๊ะ |
| Same concept, same Oracle | 0.90 | concept เดียวกัน Oracle เดียวกัน |
| Same concept, cross-Oracle | 0.85 | concept เดียวกัน ต่าง Oracle |
| Semantic similarity > 0.8 | 0.70 | คล้ายกันมาก (ถ้ามี embeddings) |
| Semantic similarity > 0.6 | 0.50 | คล้ายกันบ้าง |
| < 0.6 | ไม่สร้าง edge | ไม่เกี่ยวพอ |

---

## Project Structure | โครงสร้าง project

```
graph/
├── README.md                    ← คุณกำลังอ่านอยู่ | You are here
├── package.json                 ← dependencies
├── tsconfig.json                ← TypeScript config
├── drizzle.config.ts            ← Database ORM config
├── CLAUDE.md                    ← Graph Oracle identity
│
├── src/
│   ├── server.ts                ← HTTP server entry point
│   ├── config.ts                ← Configuration (ports, paths)
│   ├── const.ts                 ← Constants
│   ├── fleet.ts                 ← Oracle registry (26 Oracles)
│   ├── types.ts                 ← Shared TypeScript types
│   │
│   ├── db/
│   │   ├── schema.ts            ← 5 tables (Drizzle ORM)
│   │   └── index.ts             ← DB initialization
│   │
│   ├── harvesters/
│   │   ├── base.ts              ← BaseHarvester (abstract class)
│   │   ├── oracle-harvester.ts  ← ดึง docs + concepts จาก Oracle
│   │   └── fleet-harvester.ts   ← จัดการ harvest ทั้ง fleet
│   │
│   ├── engine/
│   │   ├── traversal.ts         ← Multi-hop queries (4 tiers + BFS)
│   │   ├── scoring.ts           ← 5D scoring + RRF
│   │   ├── discovery.ts         ← Bridge/chain/cluster detection
│   │   └── community.ts         ← Leiden community detection
│   │
│   ├── routes/
│   │   ├── health.ts            ← /api/health
│   │   └── graph.ts             ← /api/graph/* endpoints
│   │
│   └── cli/
│       └── index.ts             ← CLI commands
│
└── ψ/                           ← Oracle brain (memory, inbox, etc.)
```

---

## Contributing | ร่วมพัฒนา

### สิ่งที่ต่อยอดได้ | What you can build on top

| Area | Idea | Difficulty |
|---|---|---|
| **Harvester ใหม่** | ดึงจาก GitHub Issues, Slack, Notion | Easy |
| **Relationship types** | เพิ่ม CONTRADICTS, DEPENDS_ON, EVOLVES_FROM | Easy |
| **LLM Scoring** | ให้ Claude ประเมิน discovery แทน heuristics | Medium |
| **Studio Page** | สร้างหน้า visualization ใน Oracle Studio | Medium |
| **Auto Harvest** | ตั้ง cron harvest ทุก 1 ชม. | Easy |
| **Embeddings** | เพิ่ม semantic similarity ให้ edges | Medium |
| **Cross-Fleet** | เชื่อม Graph Oracle ข้ามเครื่อง | Hard |

### วิธี contribute | How to contribute

```bash
# 1. Fork repo
# 2. Clone
git clone https://github.com/YOUR_USERNAME/graph-oracle.git
cd graph-oracle/graph

# 3. Install
bun install

# 4. Start server
bun run server

# 5. ทดสอบ | Test
bun run cli harvest
bun run cli discover
bun run cli stats

# 6. สร้าง branch + แก้ไข + ส่ง PR
git checkout -b feat/your-feature
# ... make changes ...
git add . && git commit -m "feat: your feature"
git push origin feat/your-feature
# → Open PR on GitHub
```

---

## Credits | เครดิต

**Techniques inspired by (concepts only, all code written from scratch in TypeScript):**

- **[Project PROMETHEUS](https://github.com/wisd0m1969/Project-PROMETHEUS)** — Multi-hop knowledge graph traversal, 5-dimensional scoring system, self-growing graph pattern
- **[GitNexus](https://github.com/abhigyanpatwari/GitNexus)** — Reciprocal Rank Fusion (RRF) for merging search results, Leiden community detection, confidence-scored relationships, impact/blast radius analysis, BFS with constraints

**Built with:**
- [Bun](https://bun.sh) — Runtime
- [Hono](https://hono.dev) — HTTP framework
- [Drizzle ORM](https://orm.drizzle.team) — Database ORM
- [SQLite](https://sqlite.org) — Database

---

## License

MIT

---

