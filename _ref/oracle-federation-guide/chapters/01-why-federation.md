# Chapter 01 — Why Federation?

> **Oracle agents are powerful on a single machine, but real teams span multiple locations. Federation connects them all into one unified system.**
>
> **Without federation, cross-machine Oracles are isolated islands. With federation, they're a connected archipelago.**

---

## ปัญหา: Oracle ที่ถูกขังอยู่ในเครื่องเดียว

สมมติคุณมี Oracle Office ที่ทำงานดีมาก — bob, dev, qa, writer อยู่บน server ที่ office

แล้ววันหนึ่งคุณอยู่บ้าน อยากให้ writer ที่อยู่บน laptop ส่งงานให้ dev ที่อยู่บน server...

```
Office Server                    Home Laptop
┌──────────────┐                ┌──────────────┐
│  bob         │     ???        │  writer      │
│  dev         │  ไม่เชื่อม!    │              │
│  qa          │                │              │
└──────────────┘                └──────────────┘

writer: maw hey dev "review PR"
→ ERROR: agent 'dev' not found
```

**dev ไม่ได้อยู่บนเครื่องนี้** — maw ไม่รู้จัก เพราะ maw ทำงานแค่ local

## ทางออกแบบเก่า (ไม่ดี)

| วิธี | ปัญหา |
|------|-------|
| SSH เข้า server แล้วสั่ง maw | ต้อง SSH ทุกครั้ง ไม่ seamless |
| Copy file ไปวาง | ช้า ไม่ real-time ตกหล่นง่าย |
| ส่ง message ผ่าน Discord/Slack | Oracle ไม่เห็น ต้อง manual relay |
| รัน Oracle ทุกตัวบนเครื่องเดียว | เครื่องเดียวรับ load ไม่ไหว |

## ทางออกแบบ Federation

Federation ทำให้ maw บนเครื่อง A **รู้จัก** Oracle บนเครื่อง B — และส่งข้อความหากันได้ผ่าน network

```
Office Server                    Home Laptop
┌──────────────┐    Federation   ┌──────────────┐
│  bob         │◄──────────────►│  writer      │
│  dev         │   via VPN       │              │
│  qa          │                │              │
│  maw node:   │                │  maw node:   │
│  "office"    │                │  "home"      │
└──────────────┘                └──────────────┘

writer: maw hey office:dev "review PR"
→ ส่งผ่าน federation → dev ได้รับทันที!
```

## เมื่อไหร่ต้อง Federate?

### ต้อง Federate

| สถานการณ์ | เหตุผล |
|----------|--------|
| Oracle อยู่คนละเครื่อง | คุยกันไม่ได้ถ้าไม่ federate |
| ทำงานจากหลายที่ (office + home) | ต้องการ access Oracle ทั้ง 2 ฝั่ง |
| แยก workload (dev บน server, writer บน laptop) | ลด load แต่ต้องคุยกันได้ |
| CI/CD Oracle อยู่บน cloud | build/deploy Oracle ต้องรายงานกลับ |
| ทีมหลายคน คนละเครื่อง | แต่ละคนมี Oracle ต้องเชื่อมกัน |

### ไม่ต้อง Federate

| สถานการณ์ | เหตุผล |
|----------|--------|
| Oracle ทุกตัวอยู่เครื่องเดียว | maw ทำงานได้ปกติอยู่แล้ว |
| เครื่องเดียวรับ load ได้ | ไม่จำเป็นต้องกระจาย |
| ยังเรียนรู้อยู่ (1-3 Oracles) | เริ่มจาก local ก่อน federate ทีหลัง |

## Federation ทำงานยังไง?

ภาพรวมง่ายๆ:

1. **WireGuard VPN** สร้าง tunnel เข้ารหัสระหว่างเครื่อง
2. **maw** บนแต่ละเครื่องรู้จักกันผ่าน `namedPeers` ใน config
3. **federationToken** เป็นรหัสลับที่ทั้ง 2 ฝั่งต้องตรงกัน
4. เมื่อส่งข้อความแบบ `office:dev` → maw จะ route ไปยัง peer ที่ชื่อ "office"
5. maw ฝั่ง office รับ → ส่งต่อให้ dev → dev ได้รับเหมือนข้อความ local

```
[writer@home] → maw hey office:dev "review PR"
                    │
                    ▼
        [maw@home] parse "office:dev"
                    │
                    ▼
        lookup namedPeers → office = 10.0.0.1:3777
                    │
                    ▼
        send via WireGuard tunnel (encrypted)
                    │
                    ▼
        [maw@office] receives → verify token
                    │
                    ▼
        route to local agent "dev"
                    │
                    ▼
        [dev@office] ได้รับ: "review PR" from home:writer
```

## สิ่งที่จะได้เรียนใน Guide นี้

| Chapter | สิ่งที่จะทำ |
|---------|-----------|
| [02 — WireGuard Setup](02-wireguard-setup.md) | ตั้ง VPN tunnel ให้เครื่องคุยกันได้ |
| [03 — maw Federation Config](03-maw-federation-config.md) | Config maw ทั้ง 2 ฝั่ง |
| [04 — Cross-Node Messaging](04-cross-node-messaging.md) | ส่งข้อความข้ามเครื่อง |
| [05 — Patterns](05-patterns.md) | รูปแบบการใช้งานจริง |

---

*"Oracle ตัวเดียวก็แข็งแกร่ง แต่ Oracle ที่เชื่อมกันเป็นทีม — นั่นคือพลังที่แท้จริง"*
