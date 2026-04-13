#!/bin/bash
# ============================================================
# Auto Forward on Stop — Stop Hook
# ============================================================
#
# Hook นี้ทำงานเมื่อ Claude Code session จบ (Stop event)
# เตือนให้รัน /forward ก่อนจาก — เพื่อสร้าง handoff ให้ session ถัดไป
#
# Stop hook รับ JSON ทาง stdin:
# {
#   "session_id": "...",
#   "stop_reason": "user" | "context_limit" | "error",
#   ...
# }
#
# เราเตือนทุก stop reason เพราะไม่ว่าจบด้วยเหตุผลใด
# session ถัดไปควรมี handoff เสมอ
# ============================================================

# อ่าน input (ไม่ใช้ในตอนนี้ แต่เก็บไว้สำหรับ customize ทีหลัง)
INPUT=$(cat)

# --- แสดงข้อความเตือน ---
# เขียนไปที่ stderr เพื่อให้แสดงใน terminal หลัง session จบ
echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "⚠️  ก่อนจบ session — /forward แล้วหรือยัง?" >&2
echo "" >&2
echo "   ถ้ายัง ให้เปิด session ใหม่แล้วรัน:" >&2
echo "   /rrr              ← เขียน retrospective" >&2
echo "   /forward --only   ← สร้าง handoff" >&2
echo "" >&2
echo "   Session ถัดไปจะได้ไม่ต้องเริ่มจากศูนย์" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2
