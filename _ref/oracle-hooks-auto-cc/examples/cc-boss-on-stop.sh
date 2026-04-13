#!/bin/bash
# cc-boss-on-stop.sh — Auto CC Boss เมื่อ session จบ
#
# ใช้กับ: Stop event
# ทำอะไร: ดู git status แล้วส่งสรุปให้ Boss Oracle ผ่าน maw hey
# ติดตั้ง: copy ไป ~/.oracle/hooks/ แล้วลงทะเบียนใน settings.json
#
# ตั้งค่า:
#   BOSS_NAME — ชื่อ Boss Oracle ของคุณ (default: "boss")
#   MAW_CLI   — path ไปยัง maw cli

BOSS_NAME="${BOSS_NAME:-boss}"
MAW_CLI="${MAW_CLI:-$(which maw 2>/dev/null || echo "$HOME/repos/github.com/BankCurfew/maw-js/src/cli.ts")}"

# อ่าน input จาก Claude Code
INPUT=$(cat)

# หาชื่อ Oracle จาก folder
CWD="$(pwd)"
ORACLE_NAME=""
if [[ "$CWD" =~ ([^/]+)-[Oo]racle ]]; then
  ORACLE_NAME="${BASH_REMATCH[1]}"
else
  ORACLE_NAME="$(basename "$CWD")"
fi

# ถ้าเราคือ Boss → ไม่ cc ตัวเอง
if [[ "${ORACLE_NAME,,}" == "${BOSS_NAME,,}" ]]; then
  exit 0
fi

# Debounce: cc ได้ทุก 60 วินาทีเท่านั้น
LOCK_FILE="/tmp/cc-boss-${ORACLE_NAME}.lock"
if [ -f "$LOCK_FILE" ]; then
  LOCK_AGE=$(( $(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0) ))
  if [ "$LOCK_AGE" -lt 60 ]; then
    exit 0
  fi
fi
touch "$LOCK_FILE"

# สรุปว่าทำอะไรไป
RECENT_COMMIT=$(git log --oneline --since="5 minutes ago" -1 2>/dev/null)
STAGED=$(git diff --cached --name-only 2>/dev/null | head -3 | tr '\n' ', ' | sed 's/,$//')
CHANGED=$(git diff --name-only HEAD 2>/dev/null | head -3 | tr '\n' ', ' | sed 's/,$//')

if [ -n "$RECENT_COMMIT" ]; then
  SUMMARY="committed: $RECENT_COMMIT"
elif [ -n "$STAGED" ]; then
  SUMMARY="staged: $STAGED"
elif [ -n "$CHANGED" ]; then
  SUMMARY="modified: $CHANGED"
else
  SUMMARY="session ended"
fi

# ส่ง cc ให้ Boss (async)
if command -v bun &>/dev/null && [ -f "$MAW_CLI" ]; then
  bun "$MAW_CLI" hey "$BOSS_NAME" "cc: ${ORACLE_NAME} — ${SUMMARY} — done" &>/dev/null &
elif command -v maw &>/dev/null; then
  maw hey "$BOSS_NAME" "cc: ${ORACLE_NAME} — ${SUMMARY} — done" &>/dev/null &
fi

# แสดงให้คนเห็น
echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "✅ Auto CC'd ${BOSS_NAME} — ${ORACLE_NAME}: ${SUMMARY}" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2
