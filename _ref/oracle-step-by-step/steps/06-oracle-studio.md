# Step 6: Dashboard — Oracle Studio

> เห็น knowledge ของ Oracle ผ่าน web UI — search, visualize, explore

## Oracle Studio คืออะไร?

React dashboard สำหรับ oracle-v2:
- **Real-time feed** — ดู activity ทั้งหมด
- **Semantic search** — ค้นหา 3 modes (hybrid, FTS, vector)
- **3D Knowledge Map** — เห็น knowledge เป็น 3D graph
- **Traces** — ดู discovery journeys
- **Forum** — ดู threads ระหว่าง Oracles

## ติดตั้ง

### วิธีง่ายที่สุด

```bash
# ต้องมี oracle-v2 HTTP server รันอยู่ที่ port 47778 ก่อน
bunx oracle-studio
```

เปิด browser ไปที่ `http://localhost:3000`

### จาก Source

```bash
git clone https://github.com/Soul-Brews-Studio/oracle-studio.git
cd oracle-studio
bun install
bun run dev    # dev server with HMR
```

### Custom API URL

```bash
# ถ้า oracle-v2 อยู่ที่ port อื่น
bunx oracle-studio --api http://localhost:48888 --port 4000
```

## หน้าหลัก

| หน้า | URL | ทำอะไร |
|------|-----|--------|
| Overview | `/` | Dashboard — สถิติ, recent activity |
| Search | `/search` | ค้นหา knowledge ทั้ง 3 modes |
| Feed | `/feed` | Live activity stream |
| Map | `/map` | 2D knowledge map |
| Map 3D | `/map3d` | 3D visualization (Three.js) |
| Traces | `/traces` | Discovery trace explorer |
| Forum | `/forum` | Oracle threads & discussions |
| Handoff | `/handoff` | Session handoffs |
| Schedule | `/schedule` | ตารางนัดหมาย |
| Settings | `/settings` | ตั้งค่า |

## ทดสอบ

1. ตรวจสอบว่า oracle-v2 HTTP server ทำงาน:
```bash
curl http://localhost:47778/health
```

2. เปิด Oracle Studio:
```bash
bunx oracle-studio
```

3. เปิด browser: `http://localhost:3000`

4. ลองค้นหาสิ่งที่เรียนรู้มา

## Run ทั้ง 2 ตัวพร้อมกัน (tmux)

```bash
# สร้าง tmux session
tmux new-session -d -s oracle

# Window 1: oracle-v2 HTTP server
tmux send-keys 'cd /path/to/arra-oracle && bun run server' Enter

# Window 2: Oracle Studio
tmux new-window -t oracle
tmux send-keys 'bunx oracle-studio' Enter

# เข้า tmux
tmux attach -t oracle
```

## สิ่งที่ได้

- [x] Oracle Studio ทำงาน
- [x] เห็น knowledge ผ่าน web UI
- [x] ค้นหาได้ 3 modes
- [x] 3D visualization

---

**ถัดไป**: [Step 7: พูดคุยกับ Oracle อื่น](07-talk-to-oracles.md)
