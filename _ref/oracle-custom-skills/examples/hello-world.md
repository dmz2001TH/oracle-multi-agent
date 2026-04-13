# Example: Hello World Skill

> Skill ง่ายที่สุด — ทักทาย user

## ไฟล์: `.claude/skills/hello.md`

```markdown
---
name: hello
description: ทักทาย — skill แรกของคุณ
---

สวัสดีครับ! ผมคือ Oracle ของคุณ

วันนี้วันที่: ใช้ Bash tool รัน `date` แล้วบอกวันที่

ถ้า user ใส่ชื่อมา ให้ทักทายด้วยชื่อนั้น
ถ้าไม่ใส่ ให้ทักทายแบบทั่วไป
```

## วิธีใช้

```
/hello          → "สวัสดีครับ! วันนี้วันที่ ..."
/hello แบงค์    → "สวัสดีครับ แบงค์! วันนี้วันที่ ..."
```

## ติดตั้ง

```bash
mkdir -p .claude/skills
cp hello-world.md .claude/skills/hello.md
```

## อธิบาย

| ส่วน | ทำอะไร |
|------|--------|
| `name: hello` | ตั้งชื่อ slash command → `/hello` |
| `description` | อธิบายสั้น ๆ สำหรับ skill list |
| Body | prompt ที่บอก Claude Code ว่าทำอะไร |
| `date` command | ให้ Oracle บอกวันที่ปัจจุบัน |
| if/else logic | handle ทั้งกรณีมีและไม่มี argument |

## ปรับแต่ง

- เปลี่ยนภาษาได้: "Tone: ภาษาอังกฤษ"
- เพิ่ม info ได้: "บอก weather ด้วย"
- เพิ่ม personality ได้: "ทักทายแบบ pirate"

---

*"The Oracle Keeps the Human Human"*
