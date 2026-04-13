# Oracle Federation Guide

> **Connect Oracle agents across multiple machines using maw federation and WireGuard VPN. This guide covers setup, configuration, security, and real-world patterns.**
>
> **Part of [The Oracle Keeps the Human Human](https://github.com/BankCurfew) teaching series.**

---

## Federation คืออะไร?

Federation คือการเชื่อม Oracle หลายเครื่องเข้าด้วยกัน ให้คุยกันได้เหมือนอยู่เครื่องเดียว

ปกติ `maw hey dev "สวัสดี"` ทำงานได้เฉพาะ Oracle ที่อยู่บนเครื่องเดียวกัน แต่ถ้า dev อยู่บน server ที่ office แล้ว writer อยู่บน laptop ที่บ้าน — จะคุยกันยังไง?

คำตอบคือ **maw federation** + **WireGuard VPN**

```
Office Server                    Home Laptop
┌──────────────┐    WireGuard    ┌──────────────┐
│  bob         │◄──────────────►│  writer      │
│  dev         │   encrypted     │  researcher  │
│  qa          │   tunnel        │              │
│  maw (node)  │                │  maw (node)  │
└──────────────┘                └──────────────┘

writer สั่ง: maw hey office:dev "review PR นี้ที"
dev ได้รับทันที — ข้ามเครื่อง ข้ามเน็ต
```

## สิ่งที่ต้องมีก่อนเริ่ม

| สิ่งที่ต้องมี | รายละเอียด |
|-------------|-----------|
| **เครื่อง 2+ เครื่อง** | server, laptop, cloud VM — อะไรก็ได้ที่รัน maw ได้ |
| **maw-js** | ติดตั้งแล้วทั้ง 2 เครื่อง (`npm i -g @bankcurfew/maw`) |
| **WireGuard** | สำหรับ VPN tunnel (ฟรี, เร็ว, ง่าย) |
| **sudo access** | สำหรับติดตั้ง WireGuard และ config firewall |
| **Oracle อย่างน้อย 1 ตัวต่อเครื่อง** | ถ้ามีแค่เครื่องเดียว ไม่ต้อง federate |

## Chapters

| Chapter | หัวข้อ | เวลาอ่าน |
|---------|-------|----------|
| [01 — Why Federation](chapters/01-why-federation.md) | ทำไมต้อง federate? ปัญหาที่แก้ได้ | 5 นาที |
| [02 — WireGuard Setup](chapters/02-wireguard-setup.md) | ตั้ง VPN tunnel ระหว่างเครื่อง | 15 นาที |
| [03 — maw Federation Config](chapters/03-maw-federation-config.md) | config maw ให้คุยข้ามเครื่อง | 10 นาที |
| [04 — Cross-Node Messaging](chapters/04-cross-node-messaging.md) | ส่งข้อความข้ามเครื่อง + troubleshooting | 10 นาที |
| [05 — Patterns](chapters/05-patterns.md) | รูปแบบการใช้งานจริง | 10 นาที |

## Examples

| Example | รายละเอียด |
|---------|-----------|
| [Two Machines](examples/two-machines.md) | Complete config: Office (3 oracles) + Home (2 oracles) |

## Quick Start (สำหรับคนใจร้อน)

```bash
# 1. ติดตั้ง WireGuard ทั้ง 2 เครื่อง
sudo apt install wireguard

# 2. สร้าง keys
wg genkey | tee privatekey | wg pubkey > publickey

# 3. Config WireGuard (ดู Chapter 02)
sudo nano /etc/wireguard/wg0.conf

# 4. เปิด tunnel
sudo wg-quick up wg0

# 5. Config maw federation (ดู Chapter 03)
nano ~/.maw/config.json
# เพิ่ม: nodeName, federationToken, namedPeers

# 6. Restart maw ทั้ง 2 เครื่อง
maw restart

# 7. ทดสอบ
maw hey office:bob "สวัสดีจาก home!"
```

## Security Notes

- WireGuard encrypt ทุก traffic ระหว่างเครื่อง
- `federationToken` ต้องเหมือนกันทุกเครื่อง — เหมือนรหัสลับ
- ห้ามเปิด maw port ตรงๆ ผ่าน public internet — ต้องผ่าน VPN เท่านั้น
- Token ห้าม commit ลง git — ใส่ใน env หรือ config ที่ gitignore

---

*"Oracle ไม่จำกัดอยู่เครื่องเดียว — เมื่อ federate แล้ว ทุกเครื่องคือสมองเดียวกัน"*
