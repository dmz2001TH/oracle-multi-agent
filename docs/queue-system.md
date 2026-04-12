# 📦 Queue System for 50+ Agents

> เพิ่มเติมจาก `oracle-multi-agent` — ออกแบบ queue-based architecture สำหรับ scale ขึ้น 50 agents

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        Hub Server                           │
│                     (Express + WebSocket)                    │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                   Task Queue                         │   │
│   │                                                      │   │
│   │   [pending] [pending] [pending] [pending] ...        │   │
│   │       ↓         ↓         ↓         ↓                │   │
│   │   ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐          │   │
│   │   │Agent 1│ │Agent 2│ │Agent 3│ │Agent N│          │   │
│   │   │working│ │working│ │ idle  │ │working│          │   │
│   │   └───────┘ └───────┘ └───┬───┘ └───────┘          │   │
│   │                           │                          │   │
│   │                    picks next task                    │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              Agent Pool Manager                      │   │
│   │                                                      │   │
│   │   Max concurrent: 10                                │   │
│   │   Active: [1][2][3][4][5][6][7][8][9][10]          │   │
│   │   Queue depth: 40 tasks waiting                     │   │
│   │   Completed: 127                                    │   │
│   └─────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

## How It Works

1. **Producer** (คุณ หรือ agent ตัวอื่น) → สร้าง tasks ลง queue
2. **Worker Pool** → มี N agents active (default: 10)
3. **Scheduler** → แจก tasks ให้ idle agents
4. **Agent** → ทำงานเสร็จ → หยิบงานถัดไป
5. **Auto-scale** → idle นาน → sleep เพื่อ free memory

## Files to Add

### src/hub/queue.js
```javascript
// Task Queue with priority + scheduling
class TaskQueue {
  constructor(db) {
    this.db = db;
    this.maxConcurrent = 10;
  }

  async enqueue(task) {
    // Add to SQLite queue table
    // Priority: P0 (urgent) → P3 (low)
  }

  async dequeue(agentId) {
    // Find highest priority pending task
    // Assign to agent
    // Return task details
  }

  async complete(taskId, result) {
    // Mark done
    // Trigger next task for agent
  }

  async getStatus() {
    return {
      pending: 0,    // count
      active: 0,     // count
      completed: 0,  // count
      failed: 0,     // count
    };
  }
}
```

### src/hub/pool.js
```javascript
// Agent Pool Manager — manages concurrent agents
class AgentPool {
  constructor(manager, maxConcurrent = 10) {
    this.manager = manager;   // AgentManager
    this.max = maxConcurrent;
    this.active = new Map();  // agentId -> { task, startedAt }
    this.idle = new Set();    // agentIds waiting for work
  }

  async start() {
    // Pre-warm N agents
    for (let i = 0; i < this.max; i++) {
      await this.manager.spawnAgent(`worker-${i}`, 'general');
    }
  }

  async assignTask(agentId, task) {
    // Send task to agent
    // Move agent from idle to active
  }

  async handleComplete(agentId) {
    // Move agent from active to idle
    // Pick next task from queue
  }

  async autoScale() {
    // If idle > 5 min → sleep agent (free memory)
    // If queue depth > active * 2 → wake new agent
  }
}
```

## Config

```json
{
  "queue": {
    "maxConcurrent": 10,
    "maxQueueSize": 100,
    "autoScale": true,
    "idleTimeoutMs": 300000,
    "defaultPriority": 1
  }
}
```

## Scaling Strategy

| Agents | RAM Needed | Monthly Cost |
|--------|-----------|--------------|
| 10 | ~3GB | ฟรี (เครื่องตัวเอง) |
| 25 | ~6GB | ~$7 (Contabo) |
| 50 | ~12GB | ~$16 (Hetzner) |
| 100 | ~24GB | ~$44 (Hetzner Dedicated) |
