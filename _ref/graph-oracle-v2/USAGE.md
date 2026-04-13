---

# Graph Oracle — Usage Guide | คู่มือการใช้งาน

## สิ่งที่ Graph Oracle ทำได้ | What Graph Oracle Can Do

| ความสามารถ | Capability | คำสั่ง | Command |
|---|---|---|---|
| ดึงความรู้จากทุก Oracle | Harvest knowledge from fleet | `bun run cli harvest` | |
| ค้นหาความเชื่อมโยงข้ามทีม | Find cross-team connections | `bun run cli discover` | |
| ดูสถิติ graph | View graph stats | `bun run cli stats` | |
| ค้นหา concept/node | Search the graph | `bun run cli search "keyword"` | |
| ดูสะพานข้ามโดเมน | View cross-domain bridges | `bun run cli bridges` | |
| สำรวจหลายขั้น | Multi-hop traversal | `bun run cli traverse --from=<id> --depth=3` | |
| รายงานกลับไป Oracle | Report to relevant Oracles | `bun run cli report --id=<id>` | |
| เปิด API server | Start API server | `bun run server` | |

---

## คำสั่งละเอียด | Detailed Commands

### `harvest` — ดึงความรู้ | Collect Knowledge

ดึง documents + concepts จาก Oracle ทุกตัวที่ออนไลน์ แล้วสร้าง nodes + edges ใน graph

Fetches documents + concepts from every online Oracle, then creates nodes + edges in the graph.

```bash
# ดึงจากทุก Oracle | From all Oracles
bun run cli harvest

# ดึงจาก Oracle เฉพาะตัว | From one Oracle
bun run cli harvest --oracle=cyber

# ดึงเฉพาะที่เปลี่ยน (เร็วกว่า) | Only changes (faster)
bun run cli harvest --incremental
```

**ตัวอย่างผลลัพธ์ | Example output:**
```
Harvesting fleet...
  ✓ wisdom   — 142 nodes, 89 edges (3.2s)
  ✓ ruj      — 98 nodes, 67 edges (2.8s)
  ✓ vanda    — 205 nodes, 134 edges (4.1s)
  ✓ cyber    — 176 nodes, 112 edges (3.5s)
  ✗ hr       — offline, skipped

Total: 621 nodes, 402 edges from 4 Oracles
```

**เบื้องหลัง | What happens:**
1. เรียก `GET /api/fleet` → หา Oracle ที่ออนไลน์
2. เรียก `GET /api/list?limit=1000` ของแต่ละ Oracle → ได้ documents
3. Parse `concepts` JSON จากทุก document
4. สร้าง nodes: document nodes + concept nodes + oracle nodes
5. สร้าง edges: SHARES_CONCEPT, BELONGS_TO
6. สร้าง cross-Oracle edges เมื่อ 2 Oracle มี concept เดียวกัน
7. บันทึกทั้งหมดใน SQLite + log ลง `harvest_log`

---

### `discover` — ค้นหาสิ่งที่ซ่อนอยู่ | Find Hidden Connections

สำรวจ graph 4 ขั้น แล้วให้คะแนน 5 มิติ เพื่อหาความเชื่อมโยงที่ไม่มีใครเห็น

Traverses the graph in 4 tiers, scores on 5 dimensions, to find connections nobody noticed.

```bash
# ค้นหาทุกประเภท | All types
bun run cli discover

# เฉพาะ bridges | Bridges only
bun run cli discover --type=bridges

# เฉพาะ chains | Chains only
bun run cli discover --type=chains

# เฉพาะ clusters | Clusters only
bun run cli discover --type=clusters

# คะแนนขั้นต่ำ | Minimum score
bun run cli discover --min-score=7.0
```

**ตัวอย่างผลลัพธ์ | Example output:**
```
Discovering connections...

[S] 8.12 — bridge: "authentication" connects 5 Oracles
    cyber → backend → frontend → mobile → cloud
    Impact: 5 Oracles across 3 departments

[A] 7.45 — chain: cyber/sql-injection → backend/input-validation
    Cyber พบปัญหา → Backend เคยแก้แล้ว
    Impact: 2 Oracles, direct solution available

[B] 6.20 — cluster: "caching" shared by backend, frontend, cloud
    3 Oracles ทำเรื่องเดียวกันแยกกัน
    Impact: potential for standardization

Found: 3 bridges, 2 chains, 1 cluster (6 total)
```

**4 ขั้นการค้นหา | 4 Tiers:**
1. **Keyword** — หา nodes ที่มี concept เดียวกัน
2. **Neighborhood** — ขยาย 1-2 hop รอบๆ
3. **Bridges** — หา concept ที่ข้ามแผนก
4. **Deep Chains** — สำรวจ 3-4 hop ข้ามหลายโดเมน

**5 มิติคะแนน | 5 Scoring Dimensions:**
- **Novelty (25%)** — ใหม่แค่ไหน (path ยิ่งยาว ยิ่งใหม่)
- **Feasibility (20%)** — ทำได้จริงไหม (nodes connected ดี = ทำได้)
- **Impact (25%)** — กระทบมากไหม (ยิ่งหลาย Oracle ยิ่งมาก)
- **Cross-domain (20%)** — ข้ามโดเมนไหม (ต่างแผนก = ดี)
- **Specificity (10%)** — เฉพาะเจาะจงไหม (ไม่ซ้ำกับอันอื่น)

---

### `stats` — ดูสถิติ | View Statistics

แสดงภาพรวมของ graph: จำนวน nodes, edges, discoveries, คุณภาพ

Shows graph overview: node/edge counts, discoveries, quality metrics.

```bash
bun run cli stats
```

**ตัวอย่างผลลัพธ์ | Example output:**
```
Graph Oracle Stats
──────────────────
Nodes:              621
Edges:              402
Discoveries:        6
Oracles Harvested:  4/26
Last Harvest:       5 minutes ago

Quality Metrics
──────────────────
Connectivity:       82% (nodes with 3+ edges)
Orphan Rate:        3% (nodes with 0 edges)
Cross-Domain Links: 156
Communities:        4
```

---

### `search` — ค้นหาใน graph | Search the Graph

ค้นหา nodes ตาม keyword รวมผลจากหลายแหล่งด้วย RRF

Search nodes by keyword, merging results from multiple sources via RRF.

```bash
bun run cli search "authentication"
bun run cli search "caching" --oracle=backend
bun run cli search "security" --label=learning
```

**ตัวอย่างผลลัพธ์ | Example output:**
```
Search: "authentication" (RRF merged from 4 sources)

1. [concept]  authentication           — 5 Oracles, 12 edges
2. [learning] OAuth2 implementation    — backend, confidence 0.90
3. [learning] JWT token management     — cyber, confidence 0.85
4. [learning] Biometric auth flow      — mobile, confidence 0.80
5. [principle] Auth must be stateless  — vanda, confidence 0.75

5 results (merged from cyber, backend, mobile, vanda)
```

---

### `bridges` — ดูสะพานข้ามโดเมน | View Cross-Domain Bridges

แสดง concepts ที่เชื่อม Oracle ต่างแผนกเข้าด้วยกัน

Shows concepts that connect Oracles across different departments.

```bash
bun run cli bridges
```

**ตัวอย่างผลลัพธ์ | Example output:**
```
Cross-Domain Bridges
──────────────────────
1. authentication  — 5 Oracles (management, engineering, quality)
   Impact: depth 1 [cyber, backend] → depth 2 [frontend, mobile] → depth 3 [cloud]

2. caching         — 3 Oracles (engineering)
   Impact: depth 1 [backend, frontend] → depth 2 [cloud]

3. logging         — 4 Oracles (engineering, quality, communication)
   Impact: depth 1 [backend, ops] → depth 2 [cyber, doc]
```

---

### `traverse` — สำรวจหลายขั้น | Multi-hop Traversal

เริ่มจาก node ที่เลือก แล้วสำรวจออกไป N ขั้น

Start from a node and explore N hops outward.

```bash
# สำรวจ 3 ขั้น | 3 hops
bun run cli traverse --from=cyber:doc_abc --depth=3

# เฉพาะข้ามโดเมน | Cross-domain only
bun run cli traverse --from=cyber:doc_abc --depth=3 --cross-domain

# กำหนด confidence ขั้นต่ำ | Minimum confidence
bun run cli traverse --from=cyber:doc_abc --depth=3 --min-confidence=0.6
```

**ตัวอย่างผลลัพธ์ | Example output:**
```
Traverse from: cyber:doc_abc (SQL injection prevention)
Depth: 3, Cross-domain: true, Min confidence: 0.5

Path 1 (depth 2, confidence 0.85):
  cyber:doc_abc → concept:validation → backend:doc_xyz
  "SQL injection prevention" → "validation" → "Input validation middleware"
  Domains: quality → engineering

Path 2 (depth 3, confidence 0.72):
  cyber:doc_abc → concept:validation → backend:doc_xyz → concept:middleware → frontend:doc_123
  Domains: quality → engineering → engineering

3 paths found (2 cross-domain)
```

---

### `report` — รายงานกลับ | Report to Oracles

ส่ง discovery ที่ค้นพบกลับไปยัง Oracle ที่เกี่ยวข้อง ผ่านระบบ task delegation

Sends a discovery back to relevant Oracles via the task delegation system.

```bash
# รายงาน discovery เฉพาะอัน | Report specific discovery
bun run cli report --id=disc_abc123

# ดู discoveries ที่ยังไม่ได้รายงาน | List unreported
bun run cli discoveries --status=verified
```

**ตัวอย่างผลลัพธ์ | Example output:**
```
Reporting discovery: disc_abc123
  "authentication connects 5 Oracles across 3 departments"

  → Delegated to cyber: "Graph discovered: your auth patterns relate to backend's middleware"
  → Delegated to backend: "Graph discovered: your validation is relevant to cyber's findings"
  → Delegated to frontend: "Graph discovered: auth cluster — cyber & backend have patterns you may need"

Reported to 3 Oracles. Status: reported
```

**เบื้องหลัง | What happens:**
1. อ่าน discovery จาก DB
2. ดู `source_oracles` ว่าเกี่ยวกับ Oracle ไหน
3. ส่ง `POST /api/delegate` ไปยังแต่ละ Oracle ที่เกี่ยวข้อง
4. แต่ละ Oracle ได้รับ task ใน `/api/tasks`
5. อัพเดท discovery status → `reported`

---

### `server` — เปิด API | Start API Server

เปิด HTTP server สำหรับ API access และ Oracle Studio

Start HTTP server for API access and Oracle Studio integration.

```bash
bun run server
# → Graph Oracle running at http://localhost:47792

# กำหนด port | Custom port
GRAPH_PORT=47792 bun run server
```

เมื่อ server รัน สามารถเรียก API ได้ทั้งหมดตาม API Reference ใน README.md

Once running, all API endpoints from the README.md API Reference are available.
