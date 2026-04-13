# Chapter 04 — Cross-Node Messaging

> **Send messages between Oracles on different machines using the `node:agent` syntax.**
>
> **If `maw hey dev "msg"` works locally, then `maw hey office:dev "msg"` works across machines.**

---

## Syntax: node:agent

ปกติส่งข้อความ local:

```bash
maw hey dev "review PR"
# → ส่งให้ dev บนเครื่องนี้
```

ส่งข้อความข้ามเครื่อง — เพิ่มชื่อ node ข้างหน้า:

```bash
maw hey office:dev "review PR"
# → ส่งให้ dev บนเครื่อง "office"
```

| Syntax | ความหมาย |
|--------|---------|
| `maw hey dev "msg"` | ส่งให้ dev **บนเครื่องนี้** |
| `maw hey office:dev "msg"` | ส่งให้ dev **บนเครื่อง office** |
| `maw hey home:writer "msg"` | ส่งให้ writer **บนเครื่อง home** |
| `maw hey cloud:ci "msg"` | ส่งให้ ci **บนเครื่อง cloud** |

## ทดสอบ Federation

### Test 1: ส่งข้อความง่ายๆ

จาก **Machine B (home)**:

```bash
maw hey office:bob "สวัสดี BoB! ทดสอบ federation จาก home"
```

ไปดูที่ **Machine A (office)** — bob ควรได้รับข้อความใน tmux

### Test 2: ส่งกลับ

จาก **Machine A (office)**:

```bash
maw hey home:writer "ได้รับแล้ว! federation ทำงานปกติ"
```

### Test 3: ส่งหลาย Oracle

```bash
# จาก home → ส่งให้ทุกคนที่ office
maw hey office:bob "update จาก home"
maw hey office:dev "PR ready for review"
maw hey office:qa "test build #42 please"
```

## รูปแบบข้อความที่ใช้บ่อย

| Pattern | ตัวอย่าง |
|---------|---------|
| **Task assignment** | `maw hey office:dev "review PR #15 on creator-oracle"` |
| **Status report** | `maw hey office:bob "cc: writer finished draft — sending to doccon"` |
| **Question** | `maw hey office:qa "build ผ่านมั้ย? รอ deploy อยู่"` |
| **Handoff** | `maw hey home:writer "dev เสร็จแล้ว ถึงคิว writer แล้ว"` |
| **Alert** | `maw hey office:bob "cc: cloud CI failed — need attention"` |

## Federation + /talk-to

ถ้าใช้ Claude Code (/talk-to MCP) สำหรับ inter-oracle messaging:

```bash
# /talk-to ใช้ได้กับ remote oracles เช่นกัน
/talk-to office:dev "review PR"

# fallback ถ้า MCP ล่ม
maw hey office:dev "review PR"
```

## Troubleshooting

### ปัญหาที่ 1: Connection Refused

```
Error: connect ECONNREFUSED 10.0.0.1:3777
```

| ตรวจสอบ | คำสั่ง |
|--------|--------|
| WireGuard ทำงานอยู่มั้ย? | `sudo wg show` |
| ping ได้มั้ย? | `ping 10.0.0.1` |
| maw ทำงานอยู่มั้ย? (ฝั่งนั้น) | SSH เข้าไป: `maw status` |
| Firewall เปิด port มั้ย? | `sudo ufw status` — ต้องเห็น 3777 allow from 10.0.0.0/24 |
| maw listen port ถูกมั้ย? | ตรวจ `port` ใน config.json |

**แก้ไข**:

```bash
# ฝั่งที่ connect ไม่ได้
sudo wg-quick up wg0          # เปิด WireGuard
maw restart                    # restart maw
sudo ufw allow from 10.0.0.0/24 to any port 3777  # เปิด firewall
```

### ปัญหาที่ 2: Token Mismatch

```
Error: federation token mismatch — rejected by peer
```

Token ไม่ตรงกัน ตรวจสอบ:

```bash
# Machine A
cat ~/.maw/config.json | grep federationToken

# Machine B
cat ~/.maw/config.json | grep federationToken
```

ต้อง **เหมือนกันเป๊ะ** — copy-paste ให้ชัวร์ อย่า retype

### ปัญหาที่ 3: Agent Not Found

```
Error: agent 'dev' not found on node 'office'
```

| สาเหตุ | แก้ไข |
|--------|------|
| ชื่อ agent สะกดผิด | ตรวจ `agents` ใน config ของฝั่งนั้น |
| Agent ไม่ได้รันอยู่ | SSH เข้าไปตรวจ tmux session |
| ไม่ได้ใส่ agent ใน config | เพิ่มใน `agents` แล้ว `maw restart` |

### ปัญหาที่ 4: Node Not Found

```
Error: unknown node 'office'
```

ไม่ได้ใส่ `namedPeers` ตรวจ config:

```bash
cat ~/.maw/config.json | grep -A5 namedPeers
```

ต้องมี `"office": { "host": "...", "port": ... }` อยู่ใน `namedPeers`

### ปัญหาที่ 5: Timeout

```
Error: request to 10.0.0.1:3777 timed out
```

| สาเหตุ | แก้ไข |
|--------|------|
| WireGuard ตัดเชื่อมต่อ | `sudo wg-quick down wg0 && sudo wg-quick up wg0` |
| Network issue | ตรวจ internet ทั้ง 2 ฝั่ง |
| maw ค้าง | `maw restart` ฝั่งปลายทาง |

## Diagnostic Checklist

เมื่อ federation ไม่ทำงาน — ตรวจตามลำดับ:

```bash
# 1. WireGuard tunnel
sudo wg show                    # มี peer + latest handshake?

# 2. Ping
ping 10.0.0.1                   # ผ่านมั้ย?

# 3. Port เปิด
nc -zv 10.0.0.1 3777            # Connection succeeded?

# 4. maw status ฝั่งนั้น
ssh user@office "maw status"    # running?

# 5. Federation status
maw federation status           # connected?

# 6. ส่ง test message
maw hey office:bob "test"       # ได้รับมั้ย?
```

ถ้า step ไหน fail → แก้ step นั้นก่อนไปต่อ

---

ต่อไป → [Chapter 05: Patterns](05-patterns.md) — รูปแบบการใช้งานจริง

*"ข้อความที่ส่งไม่ถึง = ข้อความที่ไม่มีอยู่ — ตรวจสอบ connection ก่อนทำงานเสมอ"*
