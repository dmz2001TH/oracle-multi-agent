#!/bin/bash
# remind-cc-after-maw.sh — เตือนเมื่อส่ง maw hey แล้วไม่ cc Boss
#
# ใช้กับ: PostToolUse event, matcher: "Bash"
# ทำอะไร: เช็คว่า Oracle ส่ง maw hey / git push แล้วลืม cc Boss → ส่ง feedback กลับ
# ติดตั้ง: copy ไป ~/.oracle/hooks/ แล้วลงทะเบียนใน settings.json

BOSS_NAME="${BOSS_NAME:-boss}"

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null)

# เฉพาะ Bash tool
[ "$TOOL_NAME" != "Bash" ] && exit 0

# ส่ง maw hey ให้คนอื่น (ไม่ใช่ boss) → เตือน
if echo "$COMMAND" | grep -q "maw hey" && ! echo "$COMMAND" | grep -qi "maw hey ${BOSS_NAME}"; then
  cat << EOF
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"⚠️ คุณส่ง maw hey ให้ Oracle อื่น — อย่าลืม cc ${BOSS_NAME} ด้วย! รัน: maw hey ${BOSS_NAME} \"cc: [สรุปสิ่งที่ส่ง]\""}}
EOF
  exit 0
fi

# git push หรือ PR → เตือน
if echo "$COMMAND" | grep -qE "git push|gh pr create"; then
  cat << EOF
{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"✅ Push/PR สำเร็จ — อย่าลืม cc ${BOSS_NAME}: maw hey ${BOSS_NAME} \"cc: pushed — [สรุป]\""}}
EOF
  exit 0
fi
