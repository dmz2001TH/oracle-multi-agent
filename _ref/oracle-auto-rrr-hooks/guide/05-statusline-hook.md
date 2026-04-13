# Chapter 5: statusline.sh — อธิบายทีละบรรทัด

## ภาพรวม

StatusLine hook ทำ 2 อย่าง:
1. แสดงข้อมูล session ในบรรทัดล่างของ Claude Code
2. บันทึก raw JSON ลง /tmp เพื่อให้ force-rrr-at-80.sh อ่าน

```
📊 65% 130k/200k • 45m • Claude Opus 4 on main*
```

## ทำไมต้องมี StatusLine Hook

**ถ้าไม่มี** → คุณไม่รู้ว่า context ใช้ไปเท่าไหร่ จนกว่าจะสายเกินไป

**ถ้ามี** → เห็น % แบบ real-time ทุกครั้งที่ Claude ตอบ

และที่สำคัญ: **force-rrr-at-80.sh ต้องการไฟล์ที่ hook นี้สร้าง** ถ้าไม่มี statusline.sh → force-rrr จะไม่ทำงาน

## Code Walkthrough

### ส่วน 1: รับ Input และบันทึก

```bash
input=$(cat)
STATUSLINE_JSON="${TMPDIR:-${TMP:-${TEMP:-/tmp}}}/statusline-raw.json"
echo "$input" > "$STATUSLINE_JSON" 2>/dev/null
```

- Claude Code ส่ง JSON ขนาดใหญ่มาทาง stdin (มี session info ทั้งหมด)
- เราบันทึกลงไฟล์ → hook อื่นมาอ่านได้
- ไฟล์นี้คือ "สะพาน" ระหว่าง StatusLine hook กับ PostToolUse hook

### ส่วน 2: ดึง Context %

```bash
pct=$(echo "$input" | jq -r '.context_window.used_percentage // 0' 2>/dev/null | cut -d. -f1)
```

- `jq -r` = raw output (ไม่มี quotes)
- `.context_window.used_percentage // 0` = ถ้าไม่มี key ใช้ 0
- `cut -d. -f1` = ตัดทศนิยมออก (65.4 → 65)

### ส่วน 3: ดึง Token Usage

```bash
used_k=$(echo "$input" | jq -r '
  ((.context_window.current_usage |
    ((.input_tokens//0) + (.cache_creation_input_tokens//0) +
     (.cache_read_input_tokens//0) + (.output_tokens//0))
  ) / 1000) | floor
' 2>/dev/null)
```

- รวม tokens ทุกประเภท: input, cache (อ่าน+เขียน), output
- หาร 1000 → แสดงเป็น "K" (130k แทน 130000)
- `floor` = ปัดลง

### ส่วน 4: ระยะเวลา Session

```bash
dur_ms=$(echo "$input" | jq -r '.cost.total_duration_ms // 0' 2>/dev/null | cut -d. -f1)
s=$(( dur_ms / 1000 ))
h=$(( s / 3600 )); m=$(( (s % 3600) / 60 ))
[ "$h" -gt 0 ] && dur="${h}h${m}m" || dur="${m}m"
```

- แปลง milliseconds → ชั่วโมง+นาที
- ถ้ายังไม่ถึงชั่วโมง แสดงแค่นาที: `45m`
- ถ้าเกินชั่วโมง: `1h30m`

### ส่วน 5: Git Branch

```bash
branch=$(timeout 2 git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null)
if [ -n "$branch" ]; then
  dirty=""
  timeout 1 git -C "$cwd" diff-index --quiet HEAD -- 2>/dev/null || dirty="*"
  git_info=" on ${branch}${dirty}"
fi
```

- `timeout 2` = ถ้า git ค้าง (เช่น network drive) → ยกเลิกใน 2 วินาที
- `symbolic-ref --short HEAD` = ได้ชื่อ branch (เช่น `main`)
- `diff-index --quiet HEAD` = เช็คว่ามี uncommitted changes ไหม
  - exit 0 = clean → ไม่มี `*`
  - exit 1 = dirty → เติม `*` (เช่น `main*`)

### ส่วน 6: Output

```bash
echo "📊 ${pct}% ${used_k}k/${max_k}k • ${dur} • ${model}${git_info}"
```

StatusLine hook: **stdout = ข้อความที่แสดงใน status bar**

output 1 บรรทัดเท่านั้น (Claude Code แสดงได้แค่บรรทัดเดียว)

## Data Flow

```
Claude Code ส่ง JSON
      ↓
statusline.sh อ่าน
      ↓
   ┌──────────┐
   │ 2 outputs │
   └──┬───┬───┘
      │   │
      │   └──→ stdout: "📊 65% ..." → แสดงใน status bar
      │
      └──→ ไฟล์: /tmp/statusline-raw.json → force-rrr-at-80.sh อ่าน
```

## ต่อไป

[Chapter 6: Customization — ปรับแต่งเอง →](06-customization.md)
