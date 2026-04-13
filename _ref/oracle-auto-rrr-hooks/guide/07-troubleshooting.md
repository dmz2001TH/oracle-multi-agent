# Chapter 7: Troubleshooting — แก้ปัญหาที่พบบ่อย

## ปัญหา: Hook ไม่ทำงานเลย

### 1. เช็คว่า settings.json ถูกต้อง

```bash
# ตรวจ JSON syntax
python3 -m json.tool ~/.claude/settings.json
```

ถ้าเห็น error → JSON เสียหาย ลองเทียบกับ `examples/settings.json`

### 2. เช็คว่า script มี execute permission

```bash
ls -la ~/.claude/hooks/
# ต้องเห็น -rwxr-xr-x (มี x)

# ถ้าไม่มี:
chmod +x ~/.claude/hooks/*.sh
```

### 3. เช็คว่า script path ถูก

```bash
# Path ใน settings.json ต้องตรงกับไฟล์จริง
cat ~/.claude/settings.json | grep command
ls -la ~/.claude/hooks/
```

### 4. ทดสอบ script ด้วยมือ

```bash
echo '{}' | bash ~/.claude/hooks/auto-forward-on-stop.sh
# ต้องเห็นข้อความเตือน

echo '{"context_window":{"used_percentage":85}}' > /tmp/statusline-raw.json
bash ~/.claude/hooks/force-rrr-at-80.sh 2>&1
# ต้องเห็น warning (ครั้งแรก)
```

## ปัญหา: force-rrr ไม่เตือน

### 1. StatusLine hook ทำงานไหม?

```bash
cat /tmp/statusline-raw.json 2>/dev/null
# ถ้าไม่มีไฟล์ = statusline.sh ไม่ทำงาน
```

**แก้**: เช็คว่า `statusLine` ตั้งค่าใน settings.json:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/hooks/statusline.sh"
  }
}
```

### 2. Context ยังไม่ถึง 80%

```bash
python3 -c "
import json
with open('/tmp/statusline-raw.json') as f:
    d = json.load(f)
print(d.get('context_window',{}).get('used_percentage', 0))
"
```

ถ้าตัวเลขต่ำกว่า 80 → ยังไม่ถึง threshold (ปกติ)

### 3. Flag file ยังอยู่ (debounce)

```bash
ls /tmp/rrr-* 2>/dev/null
# ถ้ามี flag file → hook เคยเตือนแล้ว ไม่เตือนซ้ำ

# ลบ flag เพื่อทดสอบ:
rm /tmp/rrr-* 2>/dev/null
```

## ปัญหา: jq not found

```
bash: jq: command not found
```

**แก้**:

```bash
# Ubuntu/Debian
sudo apt install jq

# macOS
brew install jq

# หรือใช้ Python แทน (ไม่ต้องลง jq)
# statusline.sh ปัจจุบันใช้ jq, แก้เป็น python3:
```

```bash
# แทน jq:
pct=$(echo "$input" | jq -r '.context_window.used_percentage // 0')

# ใช้ python3:
pct=$(echo "$input" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(d.get('context_window',{}).get('used_percentage', 0))
" | cut -d. -f1)
```

## ปัญหา: python3 not found

หายากมาก (มาพร้อม macOS/Linux เกือบทุกตัว) แต่ถ้าไม่มี:

```bash
# Ubuntu/Debian
sudo apt install python3

# หรือเปลี่ยน force-rrr-at-80.sh ให้ใช้ jq แทน:
PCT=$(jq -r '.context_window.used_percentage // 0' "$STATUSLINE_JSON" | cut -d. -f1)
```

## ปัญหา: เตือนถี่เกินไป / น้อยเกินไป

ดู [Chapter 6: Customization](06-customization.md) — ส่วน "เปลี่ยน Debounce"

## ปัญหา: StatusLine ไม่แสดง Git Branch

### 1. อยู่ใน git repo หรือเปล่า?

```bash
git status
# ถ้า "not a git repository" → ไม่แสดง branch (ปกติ)
```

### 2. git ค้าง (timeout)

script ใช้ `timeout 2` ป้องกัน — ถ้า git ช้ากว่า 2 วินาที จะข้าม branch

สาเหตุที่เป็นไปได้:
- `.git` อยู่บน network drive
- repo ใหญ่มาก (> 1GB)
- git index เสีย → `git fsck`

## ปัญหา: Hook ช้า ทำให้ Claude ค้าง

Hook blocking → Claude รอจน hook เสร็จ

**เช็ค**:
```bash
time bash ~/.claude/hooks/statusline.sh < /tmp/statusline-raw.json
# ควรเสร็จใน < 0.5 วินาที
```

**แก้**:
- ลดงานใน hook — อย่าเรียก API หรือ network command
- ใช้ `timeout` กับ commands ที่อาจช้า
- Background tasks ที่ไม่ต้องการ output: `some_command &`

## Reset ทั้งหมด

ถ้ายุ่งเหยิง:

```bash
# ลบ flag files ทั้งหมด
rm /tmp/rrr-* /tmp/statusline-raw.json 2>/dev/null

# ติดตั้งใหม่
cd oracle-auto-rrr-hooks
./install.sh
```

## ขอความช่วยเหลือ

ถ้าแก้ไม่ได้:
1. เปิด issue ที่ [GitHub repo](https://github.com/the-oracle-keeps-the-human-human/oracle-auto-rrr-hooks/issues)
2. แนบ: output ของ `cat ~/.claude/settings.json` และ error ที่เห็น
3. ถามใน Discord `#help` channel
