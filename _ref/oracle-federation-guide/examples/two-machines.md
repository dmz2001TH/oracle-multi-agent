# Complete Example: Two Machines

> **Full configuration for a 2-machine setup: Office (3 Oracles) + Home (2 Oracles).**
>
> **Copy, adjust IPs and keys, and you're running.**

---

## Overview

```
Machine A: Office Server              Machine B: Home Laptop
WireGuard IP: 10.0.0.1                WireGuard IP: 10.0.0.2
┌──────────────────────┐              ┌──────────────────────┐
│  bob    (01-bob:0)   │              │  writer (01-writer:0)│
│  dev    (02-dev:0)   │◄════════════►│  researcher          │
│  qa     (03-qa:0)    │  WireGuard   │    (02-researcher:0) │
│                      │  + maw fed   │                      │
│  maw port: 3777      │              │  maw port: 3777      │
│  node: "office"      │              │  node: "home"        │
└──────────────────────┘              └──────────────────────┘
```

## Step 1: Generate Shared Federation Token

ทำครั้งเดียว บนเครื่องไหนก็ได้:

```bash
openssl rand -hex 32
# ตัวอย่างผลลัพธ์: 4f8a2b1c9d3e7f6a0b5c8d2e4f7a1b3c9d6e8f0a2b4c7d1e3f5a8b0c2d4e6f
```

เก็บ token นี้ไว้ ใช้ทั้ง 2 เครื่อง

## Step 2: WireGuard Config

### Machine A — `/etc/wireguard/wg0.conf`

```ini
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = <MACHINE_A_PRIVATE_KEY>

[Peer]
# Machine B (home laptop)
PublicKey = <MACHINE_B_PUBLIC_KEY>
AllowedIPs = 10.0.0.2/32
PersistentKeepalive = 25
```

### Machine B — `/etc/wireguard/wg0.conf`

```ini
[Interface]
Address = 10.0.0.2/24
ListenPort = 51820
PrivateKey = <MACHINE_B_PRIVATE_KEY>

[Peer]
# Machine A (office server)
PublicKey = <MACHINE_A_PUBLIC_KEY>
AllowedIPs = 10.0.0.1/32
Endpoint = <MACHINE_A_PUBLIC_IP>:51820
PersistentKeepalive = 25
```

Note: Machine B ใส่ `Endpoint` ของ A เพราะ A เป็น server ที่มี public IP คงที่

### เปิด WireGuard ทั้ง 2 เครื่อง

```bash
sudo wg-quick up wg0
sudo systemctl enable wg-quick@wg0
```

### ทดสอบ

```bash
# จาก A
ping 10.0.0.2   # ต้อง pass

# จาก B
ping 10.0.0.1   # ต้อง pass
```

## Step 3: UFW Firewall

### Machine A

```bash
sudo ufw allow 51820/udp comment "WireGuard"
sudo ufw allow from 10.0.0.0/24 to any port 3777 comment "maw federation"
```

### Machine B

```bash
sudo ufw allow 51820/udp comment "WireGuard"
sudo ufw allow from 10.0.0.0/24 to any port 3777 comment "maw federation"
```

## Step 4: maw Config

### Machine A — `~/.maw/config.json`

```json
{
  "nodeName": "office",
  "port": 3777,
  "federation": {
    "enabled": true,
    "federationToken": "4f8a2b1c9d3e7f6a0b5c8d2e4f7a1b3c9d6e8f0a2b4c7d1e3f5a8b0c2d4e6f",
    "peers": [],
    "namedPeers": {
      "home": {
        "host": "10.0.0.2",
        "port": 3777
      }
    }
  },
  "agents": {
    "bob": {
      "tmux": "01-bob:0",
      "role": "Apex Observer"
    },
    "dev": {
      "tmux": "02-dev:0",
      "role": "Developer"
    },
    "qa": {
      "tmux": "03-qa:0",
      "role": "Quality Assurance"
    }
  }
}
```

### Machine B — `~/.maw/config.json`

```json
{
  "nodeName": "home",
  "port": 3777,
  "federation": {
    "enabled": true,
    "federationToken": "4f8a2b1c9d3e7f6a0b5c8d2e4f7a1b3c9d6e8f0a2b4c7d1e3f5a8b0c2d4e6f",
    "peers": [],
    "namedPeers": {
      "office": {
        "host": "10.0.0.1",
        "port": 3777
      }
    }
  },
  "agents": {
    "writer": {
      "tmux": "01-writer:0",
      "role": "Technical Writer"
    },
    "researcher": {
      "tmux": "02-researcher:0",
      "role": "Researcher"
    }
  }
}
```

## Step 5: Restart maw

ทั้ง 2 เครื่อง:

```bash
maw restart
```

## Step 6: Verify

### ตรวจ Federation Status

```bash
# Machine A
maw federation status
# Expected:
#   node: office
#   peers:
#     home (10.0.0.2:3777) — connected

# Machine B
maw federation status
# Expected:
#   node: home
#   peers:
#     office (10.0.0.1:3777) — connected
```

### ส่ง Test Messages

```bash
# จาก Machine B (home)
maw hey office:bob "Hello from home! Federation test."
maw hey office:dev "Can you see this? Cross-node test."

# จาก Machine A (office)
maw hey home:writer "Received! Federation working."
maw hey home:researcher "Testing reverse direction."
```

## Summary Table

| Item | Machine A (Office) | Machine B (Home) |
|------|-------------------|-----------------|
| **WireGuard IP** | 10.0.0.1 | 10.0.0.2 |
| **WireGuard Port** | 51820/udp | 51820/udp |
| **maw Port** | 3777 | 3777 |
| **Node Name** | office | home |
| **Federation Token** | (same on both) | (same on both) |
| **peers** | `[]` | `[]` |
| **namedPeers** | `{ "home": ... }` | `{ "office": ... }` |
| **Agents** | bob, dev, qa | writer, researcher |
| **UFW Rules** | 51820/udp + 3777 from 10.0.0.0/24 | 51820/udp + 3777 from 10.0.0.0/24 |

## Cross-Reference Quick Commands

```bash
# จาก home → office
maw hey office:bob "msg"
maw hey office:dev "msg"
maw hey office:qa "msg"

# จาก office → home
maw hey home:writer "msg"
maw hey home:researcher "msg"
```

## Extending: Add a Third Machine

ถ้าเพิ่ม Machine C (cloud, 10.0.0.3):

1. สร้าง WireGuard key สำหรับ C
2. เพิ่ม `[Peer]` block ใน A และ B wg0.conf
3. สร้าง wg0.conf สำหรับ C (Peer A + Peer B)
4. เพิ่ม `"cloud": { "host": "10.0.0.3", "port": 3777 }` ใน namedPeers ของ A และ B
5. Config C: namedPeers มี office + home
6. `maw restart` ทุกเครื่อง

---

*"Config ที่สมบูรณ์ = Federation ที่ทำงาน — ไม่ต้องเดา แค่ทำตาม"*
