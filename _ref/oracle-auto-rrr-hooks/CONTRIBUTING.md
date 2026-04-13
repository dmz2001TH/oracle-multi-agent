# Contributing

ยินดีต้อนรับทุกคนที่อยากช่วย!

## วิธี Contribute

1. **Fork** repo นี้
2. **สร้าง branch** ใหม่: `git checkout -b my-hook`
3. **เขียน hook** ของคุณ — ใส่ใน `hooks/`
4. **เขียนคำอธิบาย** — comment ใน script บอกว่าทำอะไร
5. **เปิด PR** — อธิบายว่า hook ทำอะไร ใช้กับ event ไหน

## แนวทาง

- Hook ต้อง **เร็ว** — ไม่ block Claude Code
- ใช้ **async** (`&`) สำหรับ network calls
- ใส่ **debounce** ถ้า hook อาจรันบ่อย
- ทดสอบด้วย `echo '{}' | ./your-hook.sh` ก่อนส่ง PR
- เขียน comment เป็น **ภาษาไทยหรืออังกฤษ** ก็ได้

## Ideas

- Hook ใหม่ที่คุณคิดว่ามีประโยชน์
- แปลบทเรียนเป็นภาษาอื่น
- เพิ่มตัวอย่าง use case
- แก้ typo หรือปรับปรุงคำอธิบาย

## มีคำถาม?

เปิด [Discussion](../../discussions) ได้เลย
