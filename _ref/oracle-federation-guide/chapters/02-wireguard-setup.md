# Chapter 02 — WireGuard VPN Setup

> **WireGuard creates an encrypted tunnel between your machines so Oracle agents can communicate securely.**
>
> **It's fast, simple, and modern. Perfect for Oracle federation.**

---

## ทำไมต้อง WireGuard?

เปิด port ตรงๆ ผ่าน internet = อันตราย ใครก็เข้าได้

WireGuard สร้าง **VPN tunnel** ที่:
- เข้ารหัสทุก packet
- เฉพาะเครื่องที่มี key ถูกต้องเท่านั้นเข้าได้
- เร็วมาก (อยู่ใน Linux kernel)
- Config ง่าย ไม่กี่บรรทัด

| เปรียบเทียบ | ไม่มี VPN | มี WireGuard |
|-----------|---------|------------|
| **ความปลอดภัย** | เปิด port ตรง = เสี่ยง | encrypted tunnel |
| **ความเร็ว** | — | ใกล้เคียง native |
| **ความยุ่งยาก** | — | config ไม่กี่บรรทัด |
| **IP** | ใช้ public IP = เปลี่ยนได้ | ใช้ internal IP คงที่ (10.0.0.x) |

## Step 1: ติดตั้ง WireGuard

ทำทั้ง **2 เครื่อง**:

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install wireguard -y

# macOS
brew install wireguard-tools

# ตรวจสอบ
wg --version
```

## Step 2: สร้าง Keys

ทำบน **แต่ละเครื่อง** แยกกัน:

```bash
# สร้าง private key + public key
wg genkey | tee /tmp/privatekey | wg pubkey > /tmp/publickey

# ดู keys
cat /tmp/privatekey   # เก็บไว้ ห้ามแชร์!
cat /tmp/publickey    # อันนี้แชร์ได้ ส่งให้อีกฝั่ง
```

**สำคัญ**: private key ห้ามส่งให้ใคร ห้าม commit ลง git

สรุป keys ที่ได้:

| เครื่อง | Private Key | Public Key |
|--------|------------|------------|
| Machine A (office) | `A_PRIVATE_KEY` (เก็บไว้) | `A_PUBLIC_KEY` (ส่งให้ B) |
| Machine B (home) | `B_PRIVATE_KEY` (เก็บไว้) | `B_PUBLIC_KEY` (ส่งให้ A) |

## Step 3: Config WireGuard

### Machine A (Office Server) — `10.0.0.1`

```bash
sudo nano /etc/wireguard/wg0.conf
```

```ini
[Interface]
# Machine A's own config
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = A_PRIVATE_KEY

[Peer]
# Machine B (home)
PublicKey = B_PUBLIC_KEY
AllowedIPs = 10.0.0.2/32
# ถ้า B อยู่หลัง NAT → ใส่ Endpoint ของ B
# Endpoint = <B_PUBLIC_IP>:51820
PersistentKeepalive = 25
```

### Machine B (Home Laptop) — `10.0.0.2`

```bash
sudo nano /etc/wireguard/wg0.conf
```

```ini
[Interface]
# Machine B's own config
Address = 10.0.0.2/24
ListenPort = 51820
PrivateKey = B_PRIVATE_KEY

[Peer]
# Machine A (office)
PublicKey = A_PUBLIC_KEY
AllowedIPs = 10.0.0.1/32
Endpoint = <A_PUBLIC_IP>:51820
PersistentKeepalive = 25
```

### ใครต้องใส่ Endpoint?

| สถานการณ์ | Endpoint |
|----------|---------|
| A มี public IP คงที่ (server) | B ใส่ Endpoint ของ A |
| B มี public IP คงที่ | A ใส่ Endpoint ของ B |
| ทั้งคู่มี public IP | ใส่ทั้งคู่ก็ได้ |
| ทั้งคู่อยู่หลัง NAT | ต้องมี relay/bounce server กลาง |

**Tip**: ถ้าฝั่งหนึ่งเป็น server ที่มี public IP → ให้อีกฝั่ง connect เข้ามา (ใส่ Endpoint ฝั่ง server)

## Step 4: UFW Firewall Rules

เปิด port สำหรับ WireGuard:

```bash
# ทั้ง 2 เครื่อง — เปิด WireGuard port
sudo ufw allow 51820/udp comment "WireGuard VPN"

# Machine A — เปิด maw port เฉพาะจาก VPN subnet
sudo ufw allow from 10.0.0.0/24 to any port 3777 comment "maw federation via VPN"

# Machine B — เปิด maw port เฉพาะจาก VPN subnet
sudo ufw allow from 10.0.0.0/24 to any port 3777 comment "maw federation via VPN"

# ตรวจสอบ
sudo ufw status verbose
```

**สำคัญ**: เปิด maw port (3777) เฉพาะจาก VPN subnet `10.0.0.0/24` เท่านั้น ห้ามเปิดให้ `0.0.0.0/0`

```bash
# ถูก — เปิดเฉพาะ VPN
sudo ufw allow from 10.0.0.0/24 to any port 3777

# ผิด — เปิดให้ทุกคน (อันตราย!)
# sudo ufw allow 3777    ← ห้ามทำแบบนี้!
```

## Step 5: เปิด WireGuard

```bash
# เปิด tunnel
sudo wg-quick up wg0

# เปิดอัตโนมัติเมื่อ boot
sudo systemctl enable wg-quick@wg0

# ดูสถานะ
sudo wg show
```

ผลลัพธ์ที่ควรเห็น:

```
interface: wg0
  public key: A_PUBLIC_KEY
  private key: (hidden)
  listening port: 51820

peer: B_PUBLIC_KEY
  endpoint: <B_IP>:51820
  allowed ips: 10.0.0.2/32
  latest handshake: 12 seconds ago     ← ถ้าเห็นอันนี้ = สำเร็จ
  transfer: 1.24 KiB received, 928 B sent
```

## Step 6: ทดสอบ Connectivity

```bash
# จาก Machine A → ping Machine B
ping 10.0.0.2

# จาก Machine B → ping Machine A
ping 10.0.0.1

# ควรได้:
# PING 10.0.0.2 (10.0.0.2) 56(84) bytes of data.
# 64 bytes from 10.0.0.2: icmp_seq=1 ttl=64 time=15.3 ms
```

## Troubleshooting

| ปัญหา | สาเหตุ | แก้ไข |
|-------|-------|------|
| ping ไม่ผ่าน | Firewall block UDP 51820 | `sudo ufw allow 51820/udp` |
| ping ไม่ผ่าน | Key ผิด | ตรวจสอบ public key ตรงกัน |
| ping ไม่ผ่าน | Endpoint ผิด | ตรวจสอบ IP และ port |
| "latest handshake" ไม่ขึ้น | Peer ยังไม่ connect | ตรวจ Endpoint + firewall ทั้ง 2 ฝั่ง |
| สูญเสีย connection หลังจากพักสักพัก | ไม่มี keepalive | เพิ่ม `PersistentKeepalive = 25` |

## คำสั่งที่ใช้บ่อย

```bash
# เปิด/ปิด tunnel
sudo wg-quick up wg0
sudo wg-quick down wg0

# ดูสถานะ
sudo wg show

# ดู log
sudo journalctl -u wg-quick@wg0 -f

# restart
sudo wg-quick down wg0 && sudo wg-quick up wg0
```

## สรุป

เมื่อทำ Step 1-6 เสร็จ คุณจะมี:

- WireGuard tunnel ระหว่าง 2 เครื่อง
- IP คงที่: `10.0.0.1` (office) และ `10.0.0.2` (home)
- Firewall ที่เปิดเฉพาะ traffic จาก VPN
- ping ได้ทั้ง 2 ทาง

ต่อไป → [Chapter 03: maw Federation Config](03-maw-federation-config.md) จะ config maw ให้ใช้ tunnel นี้

---

*"VPN คืออุโมงค์ลับ — Oracle ส่งข้อความผ่านทางนี้เท่านั้น ปลอดภัยจากโลกภายนอก"*
