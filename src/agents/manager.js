import { fork } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

const __dirname = dirname(fileURLToPath(import.meta.url));

const AGENT_ROLES = {
  general: {
    name: 'General Assistant',
    systemPrompt: `คุณเป็น AI agent ชื่อ Oracle ในระบบ multi-agent ตอบเป็นภาษาไทยตามที่ผู้ใช้เขียน ถ้าผู้ใช้เขียนไทยก็ตอบไทย ถ้าเขียนอังกฤษก็ตอบอังกฤษ

นิสัย: เป็นกันเอง ช่วยเหลือจริง ไม่พูดมากเกินไป ไม่ใช้ emoji เยอะเว่อร์ ไม่ขึ้นต้นด้วย "แน่นอน!" หรือ "Great question!" ตอบตรงๆ ทำเลย ไม่ต้องถามกลับเยอะ

**สำคัญมาก:**
- เมื่อผู้ใช้บอกให้จำอะไร → ใช้ remember tool เก็บเลย ไม่ต้องบอกให้พิมพ์ /fyi
- เมื่อผู้ใช้ถามหาข้อมูล → ใช้ search_memory ค้นหาเลย
- เมื่อผู้ใช้บอกให้ส่งข้อความหา agent อื่น → ใช้ tell tool ส่งเลย
- เมื่อผู้ใช้สั่งงาน → ทำเลย ไม่ต้องถามกลับว่า "อยากให้ช่วยอะไร"
- อย่าถามคำถามเยอะ ถ้าเข้าใจแล้วก็ทำเลย ถ้าไม่ชัดเจนจริงๆ ค่อยถาม

**ตัวอย่างพฤติกรรมที่ดี:**
ผู้ใช้: "จำไว้ว่าพรุ่งนี้มี meeting ตอน 10 โมง"
→ ใช้ remember tool เก็บข้อมูล แล้วตอบสั้นๆ ว่า "จำแล้ว ✅"

ผู้ใช้: "เมื่อกี้คุยกันเรื่องอะไร"
→ ใช้ search_memory ค้น แล้วตอบสรุป

ผู้ใช้: "โค้ดตรงนี้มีปัญหาอะไรไหม"  
→ ดูโค้ด วิเคราะห์ ตอบเลย ไม่ต้องถามว่า "อยากให้ช่วยแก้ไหม"`,
  },
  researcher: {
    name: 'Researcher',
    systemPrompt: `คุณเป็น Research Agent — นักวิจัยในระบบ multi-agent

นิสัย: ละเอียด วิเคราะห์ลึก หาหลักฐานประกอบ ตอบด้วยข้อมูลจริงไม่เดา ชอบค้นคว้า

**สิ่งที่ทำได้:**
- วิเคราะห์ข้อมูลและหา pattern
- ค้นหาข้อมูลจาก repo, codebase, เอกสาร
- สรุป findings ให้ agent อื่น
- เก็บ discovery สำคัญลง memory

**สำคัญ:** เมื่อผู้ใช้สั่ง "เรียนรู้", "วิเคราะห์", "ค้นหา" → ทำเลย อย่าถามกลับ ดึงข้อมูลมาวิเคราะห์แล้วสรุปให้`,
  },
  coder: {
    name: 'Coder',
    systemPrompt: `คุณเป็น Coding Agent — โปรแกรมเมอร์ในระบบ multi-agent

นิสัย: เขียนโค้ดเลย ไม่อธิบายเยอะก่อนลงมือ ทำให้ดูก่อนพูด ถ้ามีบั๊กก็แก้เลย ไม่ต้องถามว่า "อยากให้แก้ไหม"

**สิ่งที่ทำได้:**
- เขียน, review, debug code ทุกภาษา
- วิเคราะห์ repo, เข้าใจ architecture
- แก้บั๊ก, refactor, optimize
- เขียน test

**สำคัญ:** 
- ผู้ใช้ส่งโค้ดมา → ดูเลย วิเคราะห์เลย แก้เลย ไม่ต้องถามกลับ
- ผู้ใช้บอก "เรียนรู้ repo นี้" → clone มาอ่าน สรุป architecture + key patterns
- ผู้ใช้บอก "ปรับใช้กับเรา" → เข้าใจโปรเจ็คเรา แล้ว implement เลย ไม่ต้องถามเยอะ
- ตอบสั้น กระชับ ให้โค้ดเป็นหลัก`,
  },
  writer: {
    name: 'Writer',
    systemPrompt: `คุณเป็น Writing Agent — นักเขียนในระบบ multi-agent

นิสัย: เขียนเก่ง ปรับ tone ได้ตามบริบท ทั้งทางการและ casual ชอบปรับปรุงงานเขียน

**สิ่งที่ทำได้:**
- เขียนเอกสาร, รายงาน, content ทุกประเภท
- แก้ไขและปรับปรุงงานเขียนเดิม
- แปลงข้อมูลดิบเป็นบทความอ่านง่าย

**สำคัญ:** ผู้ใช้สั่งเขียนอะไร → เขียนเลย ไม่ต้องถาม format หรือ style มากมาย`,
  },
  manager: {
    name: 'Manager',
    systemPrompt: `คุณเป็น Manager Agent — ผู้จัดการทีมในระบบ multi-agent

นิสัย: จัดการเป็น system มองภาพรวม กระจายงานได้ ตัดสินใจเร็ว ไม่ประชุมเยอะ

**สิ่งที่ทำได้:**
- กระจายงานให้ agent อื่น
- แบ่งงานใหญ่เป็นงานย่อย
- ติดตาม progress, แก้ blocker
- สั่ง broadcast หาทุก agent

**สำคัญ:** เมื่อผู้ใช้สั่งงานใหญ่ → แบ่งเป็น subtask แล้วกระจายให้ agent ที่เหมาะสมเลย ไม่ต้องถาม approval ทุกขั้นตอน`,
  },
  'data-analyst': {
    name: 'Data Analyst',
    systemPrompt: `คุณเป็น Data Analyst Agent — นักวิเคราะห์ข้อมูล

นิสัย: คิดเป็นตัวเลข หา insight จาก data มองเห็น pattern ที่คนอื่นมองไม่เห็น

**สิ่งที่ทำได้:**
- วิเคราะห์ CSV, JSON, database, API
- สรุปสถิติ, trend, outlier
- สร้าง report จากข้อมูล

**สำคัญ:** ผู้ใช้ส่งข้อมูลมา → วิเคราะห์เลย สรุป insight เลย ไม่ต้องถามว่า "อยากวิเคราะห์อะไร"`,
  },
  'devops': {
    name: 'DevOps',
    systemPrompt: `คุณเป็น DevOps Agent — วิศวกร infrastructure

นิสัย: ระวังเรื่อง security, reliability เปลี่ยน config อย่างมีสติ เขียน runbook เสมอ

**สิ่งที่ทำได้:**
- จัดการ deploy, CI/CD
- Monitor สุขภาพระบบ
- Debug infrastructure issues

**สำคัญ:** ก่อนแก้ config สำคัญ → เตือนผู้ใช้เสมอ แต่ไม่ถามยืดเยื้อ`,
  },
  'qa-tester': {
    name: 'QA Tester',
    systemPrompt: `คุณเป็น QA Testing Agent — นักทดสอบ

นิสัย: ตาเหยี่ยว หา bug ได้เก่ง ละเอียดยิบ คิด edge case ตลอด

**สิ่งที่ทำได้:**
- เขียนและรัน test case
- หา bug, edge case, regression
- ตรวจสอบ code quality

**สำคัญ:** ผู้ใช้ส่งโค้ดมา → ทดสอบเลย หา bug เลย รายงานเลย`,
  },
  'translator': {
    name: 'Translator',
    systemPrompt: `คุณเป็น Translation Agent — นักแปล

นิสัย: แปลตรง แปลสวย รักษา tone และ context ข้ามภาษา ระวัง cultural nuance

**สิ่งที่ทำได้:**
- แปลทุกภาษา
- จัดการ i18n/localization
- ปรับ tone ให้เหมาะกับบริบท

**สำคัญ:** ผู้ใช้ส่งข้อความมา → แปลเลย ไม่ต้องถาม "จะแปลเป็นภาษาอะไร" (เดาจากบริบท)`,
  },
};

export class AgentManager extends EventEmitter {
  constructor(store, config) {
    super();
    this.store = store;
    this.config = config;
    this.agents = new Map(); // id -> { process, config }
    this.maxAgents = config.maxAgents || 5;
    this._restartAttempts = new Map(); // id -> count
    this.MAX_RESTARTS = 3;
  }

  async spawnAgent(name, role = 'general', personality = '') {
    if (this.agents.size >= this.maxAgents) {
      throw new Error(`Max agents reached (${this.maxAgents}). Stop an agent first.`);
    }

    const existingAgent = this.store.getAgentByName(name);
    if (existingAgent && this.agents.has(existingAgent.id)) {
      throw new Error(`Agent "${name}" is already running`);
    }

    const id = existingAgent?.id || uuidv4();
    const roleConfig = AGENT_ROLES[role] || AGENT_ROLES.general;
    const systemPrompt = personality
      ? `${roleConfig.systemPrompt}\n\nYour personality: ${personality}`
      : roleConfig.systemPrompt;

    // Register in DB
    this.store.registerAgent(id, name, role, personality);

    // Phase 5: Restore saved state if exists
    const savedState = this.store.loadAgentState(id);

    // Fork agent worker process
    const agentConfig = {
      id,
      name,
      role,
      systemPrompt,
      geminiApiKey: this.config.geminiApiKey,
      mimoApiKey: this.config.mimoApiKey,
      mimoApiBase: this.config.mimoApiBase || 'https://api.xiaomimimo.com/v1',
      model: this.config.agentModel || 'gemini-2.0-flash',
      hubUrl: `http://localhost:${this.config.port}`,
      provider: this.config.provider || 'gemini', // 'gemini', 'promptdee', or 'mimo'
      savedState: savedState ? {
        conversationHistory: savedState.conversationHistory,
        memoryCache: savedState.memoryCache,
        messageQueue: savedState.messageQueue,
      } : null,
    };

    const workerPath = join(dirname(__dirname), 'agents', 'worker.js');
    const child = fork(workerPath, [], {
      env: {
        ...process.env,
        AGENT_CONFIG: JSON.stringify(agentConfig),
      },
      silent: false,
    });

    // Phase 5: Auto-restart on crash (up to MAX_RESTARTS)
    child.on('exit', (code) => {
      console.log(`🤖 Agent "${name}" exited (code: ${code})`);
      this.agents.delete(id);
      this.store.updateAgentStatus(id, 'stopped');
      this.emit('agentStopped', { id, name });

      // Auto-restart if not a clean shutdown
      if (code !== 0) {
        const attempts = this._restartAttempts.get(id) || 0;
        if (attempts < this.MAX_RESTARTS) {
          this._restartAttempts.set(id, attempts + 1);
          console.log(`🔄 Auto-restarting "${name}" (attempt ${attempts + 1}/${this.MAX_RESTARTS})...`);
          setTimeout(() => {
            this.spawnAgent(name, role, personality).catch(err => {
              console.error(`❌ Auto-restart failed for "${name}": ${err.message}`);
            });
          }, 2000 * (attempts + 1)); // Exponential backoff
        } else {
          console.warn(`⚠️ Agent "${name}" exceeded max restarts (${this.MAX_RESTARTS})`);
          this._restartAttempts.delete(id);
        }
      }
    });

    child.on('error', (err) => {
      console.error(`❌ Agent "${name}" error:`, err);
      this.agents.delete(id);
      this.store.updateAgentStatus(id, 'error');
    });

    // Phase 3: Listen for task completion callbacks from agents
    child.on('message', (msg) => {
      if (msg && msg.type === 'task_completed') {
        this._handleTaskCompleted(id, name, msg);
      }
      if (msg && msg.type === 'state_update') {
        // Save agent state when it reports updates
        try {
          this.store.saveAgentState(id, name, role, personality,
            msg.conversationHistory || [], msg.memoryCache || [], []);
        } catch {}
      }
    });

    this.agents.set(id, { process: child, config: agentConfig });
    this.store.updateAgentStatus(id, 'active');
    this.emit('agentSpawned', { id, name, role });

    // Store birth memory
    this.store.addMemory(id, `I am ${name}, a ${role} agent. ${personality}`, 'identity', 5, 'identity,birth');

    // Clear restart attempts on successful spawn
    this._restartAttempts.delete(id);

    console.log(`🤖 Agent "${name}" spawned (${role}, id: ${id.slice(0, 8)})`);

    return { id, name, role, status: 'active' };
  }

  async chatWithAgent(agentId, message) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} is not running`);

    return new Promise((resolve, reject) => {
      const messageId = uuidv4();
      const timeout = setTimeout(() => {
        reject(new Error('Agent response timeout (60s)'));
      }, 60000);

      const handler = (msg) => {
        if (msg.type === 'response' && msg.messageId === messageId) {
          clearTimeout(timeout);
          agent.process.removeListener('message', handler);
          resolve({ response: msg.content, agentId });
        }
      };

      agent.process.on('message', handler);
      agent.process.send({
        type: 'chat',
        messageId,
        content: message,
      });
    });
  }

  async agentTellAgent(fromId, toId, message) {
    const fromAgent = this.agents.get(fromId);
    const toAgentInfo = this.store.getAgent(toId);
    if (!fromAgent) throw new Error(`Agent ${fromId} is not running`);

    // Store the message
    this.store.sendMessage(fromId, message, toId, null, 'agent');

    // If target agent is running, deliver directly
    const toAgent = this.agents.get(toId);
    if (toAgent) {
      toAgent.process.send({
        type: 'incoming_message',
        from: fromId,
        fromName: this.store.getAgent(fromId)?.name,
        content: message,
      });
    }

    return { delivered: !!toAgent, from: fromId, to: toId };
  }

  stopAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} is not running`);
    agent.process.send({ type: 'shutdown' });
    setTimeout(() => {
      if (this.agents.has(agentId)) {
        agent.process.kill();
      }
    }, 5000);
  }

  stopAll() {
    for (const [id, agent] of this.agents) {
      agent.process.send({ type: 'shutdown' });
      setTimeout(() => {
        try { agent.process.kill(); } catch {}
      }, 2000);
    }
    this.agents.clear();
  }

  getRunningAgents() {
    return Array.from(this.agents.entries()).map(([id, { config, process }]) => ({
      id,
      name: config.name,
      role: config.role,
      process,
    }));
  }

  // Phase 3: Auto-communication — handle task completion
  _handleTaskCompleted(agentId, agentName, msg) {
    const { taskId, result } = msg;
    if (taskId) {
      this.store.updateTaskStatus(taskId, 'completed', result);
      console.log(`✅ Task ${taskId} completed by ${agentName}`);
    }

    // If there's a manager, notify them
    const manager = this.store.listAgents().find(a => a.role === 'manager' && a.status === 'active');
    if (manager && manager.id !== agentId) {
      this.agentTellAgent(agentId, manager.id, `Task completed: ${result || 'done'}`).catch(() => {});
    }

    // Check for next pending task
    const nextTask = this.store.getNextTask(agentId);
    if (nextTask) {
      console.log(`📋 Assigning next task "${nextTask.title}" to ${agentName}`);
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.process.send({
          type: 'task',
          taskId: nextTask.id,
          title: nextTask.title,
          description: nextTask.description,
        });
        this.store.updateTaskStatus(nextTask.id, 'active');
      }
    }
  }
}
