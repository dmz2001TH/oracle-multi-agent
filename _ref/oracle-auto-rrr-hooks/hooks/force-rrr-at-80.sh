#!/bin/bash
# ============================================================
# Force /rrr at 70% Context — PostToolUse Hook
# ============================================================
#
# Hook นี้ทำงานหลังจาก Claude ใช้ tool ทุกครั้ง (Read, Write, Bash, etc.)
# อ่านค่า context % จาก statusline JSON แล้ว:
#   70-79% → เตือนให้เตรียม /rrr + /forward
#   80%+   → บังคับให้หยุดทำงานแล้ว /rrr ทันที
#
# ทำไม 70% ไม่ใช่ 80%?
# Claude Code จะ auto-compact (ตัดข้อมูลเก่าทิ้ง) ที่ประมาณ 80%
# ถ้ารอถึง 80% แล้วค่อย /rrr → อาจสายเกินไป compact ไปแล้ว
# เราจึงตั้งไว้ที่ 70% เพื่อให้มีเวลา /rrr + /forward ก่อน compact
#
# อยากเปลี่ยน threshold?
# แก้ตัวเลขใน WARN_THRESHOLD และ FORCE_THRESHOLD ด้านล่าง
# ============================================================

# ============================================================
# ⚙️ CONFIGURATION — เปลี่ยนได้ตามต้องการ
# ============================================================
WARN_THRESHOLD=70    # เตือนที่ % นี้ (แนะนำ 60-75)
FORCE_THRESHOLD=80   # บังคับหยุดที่ % นี้ (แนะนำ 75-90)
# ============================================================

# --- ที่เก็บ statusline JSON ---
# statusline.sh เขียนไฟล์นี้ทุกครั้งที่ status เปลี่ยน
STATUSLINE_JSON="${TMPDIR:-${TMP:-${TEMP:-/tmp}}}/statusline-raw.json"

# ถ้ายังไม่มีไฟล์ = statusline ยังไม่เคยรัน → ข้าม
[ ! -f "$STATUSLINE_JSON" ] && exit 0

# --- อ่านค่า context percentage ---
PCT=$(python3 -c "
import json
with open('$STATUSLINE_JSON') as f:
    d = json.load(f)
print(d.get('context_window',{}).get('used_percentage', 0))
" 2>/dev/null)

# ถ้าอ่านไม่ได้ → ข้าม (ไม่ block การทำงาน)
[ -z "$PCT" ] && exit 0

# ============================================================
# THRESHOLD ${FORCE_THRESHOLD}%+ — EMERGENCY STOP
# ============================================================
# context ใกล้ compact แล้ว — ต้อง /rrr เดี๋ยวนี้!
#
# Claude Code auto-compacts ที่ ~80% ถ้าไม่ /rrr ตอนนี้
# ข้อมูล session จะถูกย่อ → retrospective/diary จะไม่สมบูรณ์
#
# ใช้ flag file ป้องกันไม่ให้เตือนซ้ำทุก tool use
# flag หมดอายุทุกชั่วโมง (ใช้ชั่วโมงปัจจุบันเป็น key)

FORCE_FLAG="/tmp/rrr-forced-$(date +%Y%m%d-%H)"

if [ "$PCT" -ge "$FORCE_THRESHOLD" ] 2>/dev/null; then
  if [ ! -f "$FORCE_FLAG" ]; then
    touch "$FORCE_FLAG"
    # เขียนข้อความเตือนไปที่ stderr → Claude เห็นและปฏิบัติตาม
    cat >&2 << EOF

🚨🚨🚨 CONTEXT ${PCT}% — EMERGENCY STOP 🚨🚨🚨

Claude Code auto-compacts at ~80% — you're almost there!
ต้อง /rrr แล้ว /forward เดี๋ยวนี้เลย!
ห้ามทำอะไรต่อ — compact จะตัดข้อมูลเก่าทิ้ง!

Run NOW:
1. /rrr
2. /forward

EOF
  fi
  exit 0
fi

# ============================================================
# THRESHOLD ${WARN_THRESHOLD}-${FORCE_THRESHOLD}% — WARNING
# ============================================================
# context เริ่มเยอะ — เตรียมตัว /rrr
# ยังมีเวลาจบ task ปัจจุบัน แต่อย่าเริ่ม task ใหม่
#
# Debounce: เตือนไม่เกิน 1 ครั้งทุก ~10 นาที
# ใช้ timestamp ตัดตัวสุดท้ายเป็น key

WARN_FLAG="/tmp/rrr-warn70-$(date +%Y%m%d-%H%M | sed 's/.$//g')"

if [ "$PCT" -ge "$WARN_THRESHOLD" ] 2>/dev/null; then
  if [ ! -f "$WARN_FLAG" ]; then
    touch "$WARN_FLAG"
    cat >&2 << EOF

⚠️ Context at ${PCT}% — auto-compact happens at ~80%!
จบ task ปัจจุบัน แล้วรัน /rrr → /forward ก่อน compact

EOF
  fi
  exit 0
fi

# ต่ำกว่า ${WARN_THRESHOLD}% → ไม่ทำอะไร
exit 0
