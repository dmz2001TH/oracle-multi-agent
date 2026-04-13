# 🤖 วิธีเพิ่ม Agent ใหม่ใน Oracle Multi-Agent

## เข้าใจระบบ Agent

ระบบ Agent ทำงานผ่าน 2 ส่วน:

1. **Agent Definition** (`src/agents/definitions/*.md`) — บอกว่า agent ทำอะไร, ใช้ tools อะไร, บุคลิกเป็นยังไง
2. **Agent Role** (`src/agents/manager.js` → `AGENT_ROLES`) — system prompt ที่ส่งให้ LLM

## วิธีเพิ่ม Agent ใหม่ (3 ขั้นตอน)

### ขั้นตอน 1: สร้าง Definition File

สร้างไฟล์ `.md` ใน `src/agents/definitions/`:

```markdown
---
name: my-agent
description: สิ่งที่ agent นี้ทำ
tools: Bash, Read, Write, Edit
model: gemini-2.0-flash
---

# My Agent

คำอธิบายละเอียดเกี่ยวกับ agent นี้

## When to Use
- สถานการณ์ที่ 1
- สถานการณ์ที่ 2

## Workflow
1. ขั้นตอนแรก
2. ขั้นตอนที่สอง
3. ขั้นตอนสุดท้าย

## Output Format
```
✅ ผลลัพธ์
รายละเอียด...
```
```

### ขั้นตอน 2: เพิ่ม Role ใน manager.js

แก้ไข `src/agents/manager.js` เพิ่ม role ใหม่ใน `AGENT_ROLES`:

```javascript
'my-agent': {
  name: 'My Agent',
  systemPrompt: `You are a My Agent. Your job is to:
- Task 1
- Task 2
- Task 3

Be [personality trait]. [Additional guidance].`,
},
```

### ขั้นตอน 3: ใช้งาน

#### ผ่าน API:
```bash
# Spawn agent
curl -X POST http://localhost:3456/api/v2/agents/spawn \
  -H "Content-Type: application/json" \
  -d '{"name": "Analyst1", "role": "data-analyst", "personality": "detail-oriented"}'

# Chat with agent
curl -X POST http://localhost:3456/api/v2/agents/{agent-id}/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Analyze this CSV file: sales.csv"}'
```

#### ผ่าน Dashboard:
1. เปิด http://localhost:3456
2. คลิก "Spawn Agent"
3. เลือก role: `data-analyst`
4. ตั้งชื่อและ personality

#### ผ่าน CLI (oracle command):
```bash
oracle spawn Analyst1 data-analyst "detail-oriented, loves charts"
```

## Agent Roles ที่มีในระบบ (ปัจจุบัน)

| Role | ชื่อ | 用途 |
|---|---|---|
| `general` | General Assistant | งานทั่วไป |
| `researcher` | Researcher | วิเคราะห์ข้อมูล, ค้นคว้า |
| `coder` | Coder | เขียนโค้ด, แก้บั๊ก |
| `writer` | Writer | เขียนเอกสาร, บทความ |
| `manager` | Manager | จัดการทีม, กระจายงาน |
| `data-analyst` | Data Analyst | วิเคราะห์ข้อมูล, รายงาน |
| `devops` | DevOps | Deploy, CI/CD, Infrastructure |
| `qa-tester` | QA Tester | ทดสอบ, หาบั๊ก |
| `translator` | Translator | แปลภาษา, i18n |

## Tips

- **personality** parameter: ใส่บุคลิกเพิ่มเติม เช่น "precise and thorough", "creative and fast"
- **model**: เปลี่ยน model ใน frontmatter ได้ เช่น `opus` สำหรับงานยาก, `flash` สำหรับงานเร็ว
- **tools**: ระบุ tools ที่ agent ใช้ได้ (Bash, Read, Write, Edit, Search, etc.)
- Agent คุยกันได้ผ่าน `tell()` function — manager agent สามารถสั่งงาน agent อื่นได้
