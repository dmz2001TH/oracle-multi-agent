#!/bin/bash
# context-warning.sh — เตือนเมื่อ context window ใกล้เต็ม
#
# ใช้กับ: PostToolUse event, matcher: ".*"
# ทำอะไร: อ่าน context % จาก statusline → เตือน 80% → สั่งหยุด 90%
# ต้องการ: statusLine ที่เขียน context % ลงไฟล์ JSON
# ติดตั้ง: copy ไป ~/.oracle/hooks/ แล้วลงทะเบียนใน settings.json

STATUSLINE_JSON="${TMPDIR:-/tmp}/statusline-raw.json"

# ยังไม่มีข้อมูล → ข้าม
[ ! -f "$STATUSLINE_JSON" ] && exit 0

# อ่าน context %
PCT=$(python3 -c "
import json
with open('$STATUSLINE_JSON') as f:
    d = json.load(f)
print(d.get('context_window',{}).get('used_percentage', 0))
" 2>/dev/null)

[ -z "$PCT" ] && exit 0

# 90%+ → หยุดทันที
if [ "$PCT" -ge 90 ] 2>/dev/null; then
  FLAG="/tmp/rrr-forced-$(date +%Y%m%d-%H)"
  [ -f "$FLAG" ] && exit 0
  touch "$FLAG"

  cat >&2 << 'EOF'

🚨 CONTEXT 90%+ — ต้องหยุดเดี๋ยวนี้!

1. รัน /rrr (สรุป session)
2. รัน /forward (สร้าง handoff)
3. เปิด session ใหม่

ห้ามทำงานต่อ — ข้อมูลจะหายถ้า context ล้น!

EOF
  exit 0
fi

# 80%+ → เตือน
if [ "$PCT" -ge 80 ] 2>/dev/null; then
  WARN_FLAG="/tmp/rrr-warn80-$(date +%Y%m%d-%H%M | sed 's/.$//g')"
  [ -f "$WARN_FLAG" ] && exit 0
  touch "$WARN_FLAG"

  cat >&2 << EOF

⚠️ Context ถึง ${PCT}% แล้ว — จบ task ปัจจุบันแล้วรัน /rrr + /forward

EOF
  exit 0
fi
