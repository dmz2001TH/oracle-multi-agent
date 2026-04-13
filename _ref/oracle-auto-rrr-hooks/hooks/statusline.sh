#!/bin/bash
# ============================================================
# StatusLine Hook — แสดง context % และบันทึกลง JSON
# ============================================================
#
# Hook นี้ทำ 2 อย่าง:
# 1. แสดงข้อมูล session ในบรรทัดล่างของ Claude Code
# 2. บันทึก raw JSON ลง /tmp เพื่อให้ hook อื่นอ่านค่า context %
#
# Claude Code เรียก hook นี้ทุกครั้งที่ status เปลี่ยน
# โดยส่ง JSON เข้ามาทาง stdin
# ============================================================

# อ่าน JSON จาก stdin
input=$(cat)

# --- บันทึก raw JSON ลง temp file ---
# hook อื่น (เช่น force-rrr-at-80.sh) จะมาอ่านค่าจากไฟล์นี้
STATUSLINE_JSON="${TMPDIR:-${TMP:-${TEMP:-/tmp}}}/statusline-raw.json"
echo "$input" > "$STATUSLINE_JSON" 2>/dev/null

# --- ดึงค่าจาก JSON ---
# context % — ใช้แล้วกี่เปอร์เซ็นต์
pct=$(echo "$input" | jq -r '.context_window.used_percentage // 0' 2>/dev/null | cut -d. -f1) || pct=0

# token ที่ใช้ไป (หน่วย K)
used_k=$(echo "$input" | jq -r '
  ((.context_window.current_usage |
    ((.input_tokens//0) + (.cache_creation_input_tokens//0) +
     (.cache_read_input_tokens//0) + (.output_tokens//0))
  ) / 1000) | floor
' 2>/dev/null) || used_k=0

# context window ทั้งหมด (หน่วย K)
max_k=$(echo "$input" | jq -r '
  ((.context_window.context_window_size // 0) / 1000) | floor
' 2>/dev/null) || max_k=0

# ชื่อ model
model=$(echo "$input" | jq -r '.model.display_name // .model.id // "?"' 2>/dev/null) || model="?"

# ระยะเวลา session
dur_ms=$(echo "$input" | jq -r '.cost.total_duration_ms // 0' 2>/dev/null | cut -d. -f1) || dur_ms=0
s=$(( dur_ms / 1000 )) 2>/dev/null || s=0
h=$(( s / 3600 )); m=$(( (s % 3600) / 60 ))
[ "$h" -gt 0 ] 2>/dev/null && dur="${h}h${m}m" || dur="${m}m"

# Git branch (timeout ป้องกัน hang)
cwd=$(echo "$input" | jq -r '.workspace.current_dir // "~"' 2>/dev/null) || cwd="~"
branch=$(timeout 2 git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null)
git_info=""
if [ -n "$branch" ]; then
  dirty=""
  timeout 1 git -C "$cwd" diff-index --quiet HEAD -- 2>/dev/null || dirty="*"
  git_info=" on ${branch}${dirty}"
fi

# --- แสดงผล 1 บรรทัด ---
echo "📊 ${pct}% ${used_k}k/${max_k}k • ${dur} • ${model}${git_info}"
