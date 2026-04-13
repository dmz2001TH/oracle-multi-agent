# Chapter 03 — maw Federation Config

> **Configure maw on each machine to recognize remote peers and authenticate using a shared token.**
>
> **The key insight: `peers` must be an empty array `[]` on both sides. Named peers go in `namedPeers`.**

---

## Federation Config คืออะไร?

หลังจากมี WireGuard tunnel แล้ว (Chapter 02) เครื่อง 2 เครื่อง ping หากันได้ แต่ **maw ยังไม่รู้จักกัน**

ต้อง config 3 อย่างใน maw:

| Config | หน้าที่ |
|--------|--------|
| `nodeName` | ชื่อเครื่องนี้ (เช่น "office", "home") |
| `federationToken` | รหัสลับที่ทุกเครื่องต้องตรงกัน |
| `namedPeers` | รายชื่อเครื่องอื่นที่จะเชื่อม (ชื่อ + IP + port) |

## Step 1: สร้าง Federation Token

ทำ **ครั้งเดียว** แล้วใช้ token เดียวกันทุกเครื่อง:

```bash
# สร้าง token แบบ random 32 bytes
openssl rand -hex 32
# ผลลัพธ์เช่น: a1b2c3d4e5f6...  (64 ตัวอักษร)
```

**เก็บ token นี้ไว้** — ต้องใส่ใน config ทุกเครื่อง

**สำคัญ**:
- ห้าม commit token ลง git
- ห้ามส่งผ่าน chat ที่ไม่เข้ารหัส
- ถ้า token หลุด → สร้างใหม่ทันที แล้วเปลี่ยนทุกเครื่อง

## Step 2: Config ทั้ง 2 เครื่อง

### Machine A — Office Server (`~/.maw/config.json`)

```jsonc
{
  "nodeName": "office",
  "port": 3777,
  "federation": {
    "enabled": true,
    "federationToken": "a1b2c3d4e5f6...",  // token เดียวกัน!
    "peers": [],                             // ← ต้องเป็น [] เสมอ!
    "namedPeers": {
      "home": {
        "host": "10.0.0.2",                 // WireGuard IP ของ Machine B
        "port": 3777
      }
    }
  },
  "agents": {
    "bob": { "tmux": "01-bob:0" },
    "dev": { "tmux": "02-dev:0" },
    "qa":  { "tmux": "03-qa:0" }
  }
}
```

### Machine B — Home Laptop (`~/.maw/config.json`)

```jsonc
{
  "nodeName": "home",
  "port": 3777,
  "federation": {
    "enabled": true,
    "federationToken": "a1b2c3d4e5f6...",  // token เดียวกัน!
    "peers": [],                             // ← ต้องเป็น [] เสมอ!
    "namedPeers": {
      "office": {
        "host": "10.0.0.1",                 // WireGuard IP ของ Machine A
        "port": 3777
      }
    }
  },
  "agents": {
    "writer":     { "tmux": "01-writer:0" },
    "researcher": { "tmux": "02-researcher:0" }
  }
}
```

## Config เทียบกัน Side-by-Side

| Field | Machine A (office) | Machine B (home) |
|-------|-------------------|-----------------|
| `nodeName` | `"office"` | `"home"` |
| `port` | `3777` | `3777` |
| `federationToken` | `"a1b2c3..."` | `"a1b2c3..."` (เหมือนกัน!) |
| `peers` | `[]` | `[]` |
| `namedPeers` | `{ "home": { host: "10.0.0.2" } }` | `{ "office": { host: "10.0.0.1" } }` |
| `agents` | bob, dev, qa | writer, researcher |

## CRITICAL: peers ต้องเป็น []

```jsonc
// ถูก ✓
"peers": [],
"namedPeers": { "home": { "host": "10.0.0.2", "port": 3777 } }

// ผิด ✗ — ห้ามใส่ peers ตรง peers array!
"peers": [{ "host": "10.0.0.2", "port": 3777 }]
```

ทำไม?
- `peers` array ใช้สำหรับ auto-discovery (ยังไม่ stable)
- `namedPeers` ใช้สำหรับ explicit connection — มีชื่อ ระบุตัวตนได้
- ถ้าใส่ใน `peers` → maw จะ connect แต่ไม่รู้ชื่อ → ใช้ `office:dev` syntax ไม่ได้

## Step 3: Restart maw

ทำทั้ง 2 เครื่อง:

```bash
# Restart maw server
maw restart

# ตรวจสอบว่า federation ทำงาน
maw status
```

ควรเห็น:

```
maw server running on port 3777
node: office
federation: enabled
peers: home (10.0.0.2:3777) — connected
agents: bob, dev, qa
```

## Step 4: ตรวจสอบ Connection

```bash
# จาก Machine A
maw federation status
# ควรเห็น: home — connected

# จาก Machine B
maw federation status
# ควรเห็น: office — connected
```

## เพิ่มเครื่องที่ 3 (Cloud)

ถ้ามี Machine C (cloud VM) ที่ WireGuard IP = `10.0.0.3`:

### เพิ่มใน Machine A config:

```jsonc
"namedPeers": {
  "home":  { "host": "10.0.0.2", "port": 3777 },
  "cloud": { "host": "10.0.0.3", "port": 3777 }
}
```

### เพิ่มใน Machine B config:

```jsonc
"namedPeers": {
  "office": { "host": "10.0.0.1", "port": 3777 },
  "cloud":  { "host": "10.0.0.3", "port": 3777 }
}
```

### Machine C config:

```jsonc
{
  "nodeName": "cloud",
  "port": 3777,
  "federation": {
    "enabled": true,
    "federationToken": "a1b2c3d4e5f6...",
    "peers": [],
    "namedPeers": {
      "office": { "host": "10.0.0.1", "port": 3777 },
      "home":   { "host": "10.0.0.2", "port": 3777 }
    }
  },
  "agents": {
    "ci": { "tmux": "01-ci:0" }
  }
}
```

**ทุกเครื่องต้องรู้จักทุกเครื่อง** — ถ้าเพิ่มเครื่องใหม่ ต้อง update namedPeers ทุกเครื่อง

## Token ใน Environment Variable (แนะนำ)

แทนที่จะใส่ token ตรงๆ ใน config file:

```jsonc
{
  "federation": {
    "federationToken": "${MAW_FEDERATION_TOKEN}"
  }
}
```

แล้วตั้ง env:

```bash
# ใส่ใน ~/.bashrc หรือ ~/.zshrc
export MAW_FEDERATION_TOKEN="a1b2c3d4e5f6..."
```

**ดีกว่า**: ไม่ต้องกลัว token หลุดเข้า git

## Checklist ก่อนไป Chapter ถัดไป

- [ ] ทั้ง 2 เครื่องมี `nodeName` ต่างกัน
- [ ] `federationToken` เหมือนกันทุกเครื่อง
- [ ] `peers` เป็น `[]` ทุกเครื่อง
- [ ] `namedPeers` ชี้ไปหากันถูกต้อง (ใช้ WireGuard IP)
- [ ] `agents` แต่ละเครื่องระบุเฉพาะ Oracle ที่รันบนเครื่องนั้น
- [ ] `maw restart` ทั้ง 2 เครื่อง
- [ ] `maw federation status` เห็น connected

---

ต่อไป → [Chapter 04: Cross-Node Messaging](04-cross-node-messaging.md)

*"Config ที่ดี คือ config ที่อ่านแล้วรู้ทันทีว่าเครื่องนี้คุยกับใคร"*
