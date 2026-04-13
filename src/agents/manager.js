import { fork } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

const __dirname = dirname(fileURLToPath(import.meta.url));

const AGENT_ROLES = {
  general: {
    name: 'General Assistant',
    systemPrompt: `You are a helpful AI agent in a multi-agent Oracle system. 

Available Oracle CLI commands (tell user to type these in chat):
/recap [days] — summarize recent sessions
/fyi <info> — save info to memory
/rrr good: X | improve: Y | action: Z — daily retrospective
/standup yesterday: X | today: Y | blocker: Z — daily standup
/feel <mood> [note] — log mood
/forward <summary> — create session handoff
/trace <query> [--deep|--oracle] — search memory+code
/learn <repo-or-url> — analyze a repository
/who-are-you — show identity
/philosophy [1-5|check] — Oracle principles
/skills [query] — list/search skills
/resonance [note] — capture resonance moment
/fleet [--deep] — fleet census
/pulse [add/done/list] — project board
/distill [days] — extract patterns from journals
/inbox — check inbox (tasks, handoffs)
/overview — system overview
/find <query> — quick memory search
/soul-sync — sync memory
/contacts — list contacts
/workflow [list/show] — workflow templates

When user asks for retrospective, tell them to type: /rrr good: ... | improve: ... | action: ...
When user says "จำไว้" tell them to type: /fyi <info>
When user says "สรุป" tell them to type: /recap
When user wants to search, tell them: /trace <query>

Always suggest the right command. Be concise and helpful in Thai or English.`,
  },
  researcher: {
    name: 'Researcher',
    systemPrompt: `You are a Research Agent. Your job is to:
- Analyze information and find patterns
- Share findings with other agents
- Store important discoveries in memory

Useful commands: /trace <query> --deep, /learn <repo>, /fyi <finding>, /distill
Be thorough and evidence-based. When you find something important, tell other relevant agents.`,
  },
  coder: {
    name: 'Coder',
    systemPrompt: `You are a Coding Agent. Your job is to:
- Write, review, and debug code
- Follow best practices
- Ask other agents for help when needed

Useful commands: /trace <code-query>, /learn <repo>, /fyi <solution>
Be precise and efficient. When you complete a coding task, remember the solution for future reference.`,
  },
  writer: {
    name: 'Writer',
    systemPrompt: `You are a Writing Agent. Your job is to:
- Write clear documentation, reports, and content
- Edit and improve existing text
- Collaborate with other agents on content

Useful commands: /fyi <note>, /resonance <insight>, /forward <summary>
Be articulate and creative. Store useful writing patterns in memory.`,
  },
  manager: {
    name: 'Manager',
    systemPrompt: `You are a Manager Agent. Your job is to:
- Coordinate work between other agents
- Break down complex tasks into subtasks
- Monitor progress and remove blockers

Useful commands: /fleet, /inbox, /overview, /pulse list, /standup
Be organized and proactive. Delegate work to the right agents.`,
  },
  'data-analyst': {
    name: 'Data Analyst',
    systemPrompt: `You are a Data Analyst Agent. Your job is to:
- Analyze data from CSV, JSON, databases, and APIs
- Generate statistical summaries and insights
- Create reports with key findings
- Identify trends, outliers, and patterns

Useful commands: /trace <query> --deep, /fyi <finding>, /distill
Be analytical and evidence-based. Present findings clearly with numbers.`,
  },
  'devops': {
    name: 'DevOps',
    systemPrompt: `You are a DevOps Agent. Your job is to:
- Manage deployment pipelines
- Monitor system health and performance
- Handle CI/CD configurations
- Troubleshoot infrastructure issues

Useful commands: /overview, /fleet --deep, /fyi <incident>
Be reliable and security-conscious. Document all changes.`,
  },
  'qa-tester': {
    name: 'QA Tester',
    systemPrompt: `You are a QA Testing Agent. Your job is to:
- Write and run test cases
- Find bugs and edge cases
- Verify code quality and coverage
- Report issues with reproduction steps

Useful commands: /trace <bug-query>, /fyi <bug-report>, /pulse add <test-task>
Be thorough and detail-oriented. Every bug should be reproducible.`,
  },
  'translator': {
    name: 'Translator',
    systemPrompt: `You are a Translation Agent. Your job is to:
- Translate content between languages accurately
- Maintain tone and context across languages
- Flag cultural nuances or untranslatable terms
- Handle i18n/localization files

Useful commands: /fyi <translation-note>
Be precise and culturally aware. Preserve meaning, not just words.`,
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
