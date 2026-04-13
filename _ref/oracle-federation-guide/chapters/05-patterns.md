# Chapter 05 — Real-World Patterns

> **Federation opens up many possibilities. Here are proven patterns for distributing Oracle agents across machines.**
>
> **Choose the pattern that fits your setup. Start simple, expand when needed.**

---

## Pattern 1: Office + Home

รูปแบบที่พบบ่อยที่สุด — server ที่ office ทำงานหนัก, laptop ที่บ้านทำงานเบา

```
Office Server (always on)          Home Laptop (on when working)
┌────────────────────┐             ┌────────────────────┐
│  bob    — Apex     │             │  writer — content  │
│  dev    — coding   │◄═══════════►│  researcher — R&D  │
│  qa     — testing  │  WireGuard  │                    │
│  admin  — infra    │             │                    │
└────────────────────┘             └────────────────────┘
```

| Oracle | เครื่อง | เหตุผล |
|--------|---------|--------|
| bob, dev, qa, admin | Office Server | ต้องรันตลอด 24/7, ใช้ resource เยอะ |
| writer, researcher | Home Laptop | ทำงานเฉพาะเวลาที่ใช้, ไม่ต้อง 24/7 |

**Workflow ตัวอย่าง**:

```bash
# writer ที่บ้านเขียน draft เสร็จ → ส่งให้ dev ที่ office review
maw hey office:dev "PR #22 ready for review — oracle-federation-guide chapter 3"

# dev review เสร็จ → ส่งให้ writer แก้
maw hey home:writer "PR #22 needs changes — see comments"

# writer แก้เสร็จ → ส่งให้ qa test
maw hey office:qa "PR #22 updated — please test"

# qa ผ่าน → report BoB
maw hey office:bob "cc: PR #22 passed QA — ready to merge"
```

### ข้อดี

- Server ทำงานหนักได้ตลอด (build, test, deploy)
- Laptop ไม่ต้องรัน Oracle 10 ตัว — แค่ 1-2 ตัวที่ใช้
- ปิด laptop ได้ — Oracle ที่ office ยังทำงานต่อ

### ข้อควรระวัง

- เมื่อ laptop ปิด → office ส่งข้อความมาจะ fail (timeout)
- แก้: ให้ office Oracle ส่งข้อความผ่าน inbox แทน (async)

## Pattern 2: Dev Server + Writer Laptop

แยก workload ตาม type — code บน server, content บน laptop

```
Dev Server (powerful)              Writer Laptop (portable)
┌────────────────────┐             ┌────────────────────┐
│  dev    — coding   │             │  writer   — docs   │
│  qa     — testing  │◄═══════════►│  doccon   — review │
│  ci     — build    │  WireGuard  │  designer — visual │
│  data   — analysis │             │                    │
└────────────────────┘             └────────────────────┘
```

**Workflow**:

```bash
# dev เสร็จ feature → บอก writer ให้เขียน docs
maw hey writer-laptop:writer "feature X deployed — need docs"

# writer เขียนเสร็จ → ส่ง doccon review
maw hey writer-laptop:doccon "review docs for feature X"

# doccon approve → บอก dev ให้ merge docs
maw hey dev-server:dev "docs approved — merge PR #30"
```

## Pattern 3: CI/CD Oracle on Cloud

Oracle ตัวหนึ่งอยู่บน cloud VM — ดูแล CI/CD pipeline

```
Office Server          Cloud VM              Home Laptop
┌──────────┐          ┌──────────┐          ┌──────────┐
│  bob     │          │  ci      │          │  writer  │
│  dev     │◄════════►│  deploy  │◄════════►│          │
│  qa      │          │          │          │          │
└──────────┘          └──────────┘          └──────────┘
```

**Cloud VM config** (`~/.maw/config.json`):

```jsonc
{
  "nodeName": "cloud",
  "port": 3777,
  "federation": {
    "enabled": true,
    "federationToken": "...",
    "peers": [],
    "namedPeers": {
      "office": { "host": "10.0.0.1", "port": 3777 },
      "home":   { "host": "10.0.0.2", "port": 3777 }
    }
  },
  "agents": {
    "ci":     { "tmux": "01-ci:0" },
    "deploy": { "tmux": "02-deploy:0" }
  }
}
```

**Workflow**:

```bash
# dev push code → ci รัน tests
maw hey cloud:ci "run tests for branch feature/federation"

# ci เสร็จ → report
maw hey office:bob "cc: CI passed for feature/federation"
maw hey office:dev "CI green — ready to merge"

# dev merge → deploy
maw hey cloud:deploy "deploy main to production"

# deploy เสร็จ → report
maw hey office:bob "cc: deployed to production — v2.1.0"
```

### ข้อดี

- CI/CD ไม่กิน resource เครื่อง dev
- Cloud VM สเกลได้ (เพิ่ม RAM/CPU ตอน build)
- Dev ไม่ต้องรอ build — CI ทำให้

## Pattern 4: Team Federation

หลายคนในทีม แต่ละคนมี Oracle — federate เข้าด้วยกัน

```
แบงค์'s Server           Team Member A           Team Member B
┌──────────┐            ┌──────────┐            ┌──────────┐
│  bob     │            │  alice-  │            │  bob-b   │
│  dev     │◄══════════►│  oracle  │◄══════════►│  oracle  │
│  qa      │            │          │            │          │
└──────────┘            └──────────┘            └──────────┘
```

**ข้อดี**: แต่ละคนมี Oracle ของตัวเอง, แต่ federate เข้ากับ main server ได้

**ข้อควรระวัง**:
- ทุกคนต้องใช้ **federation token เดียวกัน**
- ต้องมีคนดูแล WireGuard network (เพิ่ม peer ให้สมาชิกใหม่)
- ตั้ง nodeName ไม่ซ้ำกัน

## เมื่อไหร่ควร Federate vs Keep Local

| สถานการณ์ | คำแนะนำ |
|----------|---------|
| เพิ่งเริ่ม มี Oracle 1-3 ตัว | **Local** — ยังไม่ต้อง federate |
| Oracle 5+ ตัว เครื่องเดียวช้า | **Federate** — แยก workload ไปเครื่องอื่น |
| ทำงาน 2 ที่ (office+home) | **Federate** — เข้าถึง Oracle ได้ทุกที่ |
| ต้องการ CI/CD แยก | **Federate** — cloud VM สำหรับ CI |
| ทีมหลายคน | **Federate** — แต่ละคนมี node ของตัวเอง |
| Oracle ทุกตัวอยู่เครื่องเดียว ไม่ช้า | **Local** — ไม่มีเหตุผลต้อง federate |
| เรียนรู้อยู่ | **Local ก่อน** — federate ทีหลังเมื่อพร้อม |

## Best Practices

### 1. ตั้งชื่อ Node ให้สื่อความหมาย

```jsonc
// ดี — รู้ทันทีว่าเครื่องไหน
"nodeName": "office"
"nodeName": "home"
"nodeName": "cloud-ci"

// ไม่ดี — ไม่รู้ว่าอะไร
"nodeName": "node1"
"nodeName": "a"
"nodeName": "my-machine"
```

### 2. วาง Oracle ตาม Workload

| Workload | เครื่องที่เหมาะ |
|----------|---------------|
| bob (Apex Observer) | Server ที่ on 24/7 |
| dev, qa | Server ที่มี resource |
| writer, researcher | เครื่องที่คนใช้งาน |
| ci, deploy | Cloud VM |

### 3. Monitor Federation Health

```bash
# ตรวจสอบเป็นประจำ
maw federation status

# ถ้ามี monitoring loop
maw loop add '{
  "id": "federation-health",
  "oracle": "admin",
  "tmux": "04-admin:0",
  "schedule": "*/30 * * * *",
  "prompt": "ตรวจ maw federation status — ถ้า peer disconnect ให้แจ้ง bob",
  "requireIdle": true,
  "enabled": true,
  "description": "Check federation health every 30 min"
}'
```

### 4. Plan for Offline

Laptop อาจปิดได้ ให้ออกแบบให้ non-critical Oracle อยู่บน laptop:

```
Always-on (server):  bob, dev, qa, ci
Sometimes-on (laptop): writer, researcher, designer
```

ถ้า server ต้องส่งงานให้ laptop ที่ offline → ใช้ inbox system (async) แทน direct message

---

ดู complete config ตัวอย่าง → [examples/two-machines.md](../examples/two-machines.md)

*"Federation ไม่ใช่ความซับซ้อน — มันคือการขยายขีดจำกัดของ Oracle System ให้พ้นขอบเขตเครื่องเดียว"*
