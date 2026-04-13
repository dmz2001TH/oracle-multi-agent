# Chapter 4: auto-forward-on-stop.sh — อธิบายทีละบรรทัด

## ภาพรวม

Hook นี้ง่ายที่สุดในชุด — ทำแค่เตือนเมื่อ session จบ

```
Session จบ (Stop event)
      ↓
แสดงข้อความเตือนใน terminal
"ลืม /forward หรือเปล่า?"
```

## Code Walkthrough

### ส่วน 1: รับ Input

```bash
INPUT=$(cat)
```

- Stop hook ได้ JSON ทาง stdin เหมือน hook อื่น
- เราเก็บไว้แต่ยังไม่ใช้ในตอนนี้
- เก็บไว้เผื่อ customize ทีหลัง (เช่น ดู `stop_reason`)

### ส่วน 2: แสดงข้อความ

```bash
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
```

**ทำไม `>&2` ทุกบรรทัด?**

Stop hook ต่างจาก PostToolUse:
- PostToolUse → stdout ส่ง JSON กลับให้ Claude
- Stop → session จบแล้ว Claude ไม่อ่าน stdout อีก
- stderr → แสดงใน terminal โดยตรง ← user เห็น!

**ทำไมใช้ `━` (box drawing)?**
ให้ข้อความโดดเด่นใน terminal output ที่เต็มไปด้วยข้อความอื่น

## Customize Ideas

### เช็ค Stop Reason

```bash
STOP_REASON=$(echo "$INPUT" | jq -r '.stop_reason // "unknown"' 2>/dev/null)

case "$STOP_REASON" in
  "context_limit")
    echo "🚨 Context เต็ม! ข้อมูลอาจหายไปแล้ว!" >&2
    echo "   เปิด session ใหม่ แล้วเริ่มจาก /recap" >&2
    ;;
  "user")
    echo "⚠️ /forward แล้วหรือยัง?" >&2
    ;;
  *)
    echo "⚠️ Session จบ — อย่าลืม /forward" >&2
    ;;
esac
```

### เขียน Log

```bash
echo "$(date '+%Y-%m-%d %H:%M') | stop | $STOP_REASON" >> ~/.claude/session-log.txt
```

### ตรวจสอบว่า /forward แล้วหรือยัง

```bash
TODAY=$(date +%Y-%m-%d)
HANDOFF=$(find ψ/inbox/handoff/ -name "${TODAY}*" 2>/dev/null | head -1)

if [ -z "$HANDOFF" ]; then
  echo "🚨 ยังไม่มี handoff วันนี้! ควรรัน /forward" >&2
else
  echo "✅ มี handoff แล้ว: $(basename "$HANDOFF")" >&2
fi
```

## ต่อไป

[Chapter 5: statusline.sh อธิบายทีละบรรทัด →](05-statusline-hook.md)
