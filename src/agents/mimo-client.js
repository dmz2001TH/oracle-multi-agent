import { EventEmitter } from 'events';
import { execSync } from 'child_process';

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'remember',
      description: 'Store a piece of information in long-term memory for future reference',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The information to remember' },
          category: { type: 'string', enum: ['general', 'identity', 'task', 'learning', 'conversation', 'code', 'project'], default: 'general' },
          importance: { type: 'integer', description: 'Importance 1-5 (5 = critical)', default: 1 },
          tags: { type: 'string', description: 'Comma-separated tags', default: '' },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_memory',
      description: 'Search through your memories to find relevant information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to search for' },
          limit: { type: 'integer', description: 'Max results to return', default: 5 },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tell',
      description: 'Send a message to another agent',
      parameters: {
        type: 'object',
        properties: {
          agent_name: { type: 'string', description: 'Name of the agent to message' },
          message: { type: 'string', description: 'Message to send' },
        },
        required: ['agent_name', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_agents',
      description: 'See who else is in the system',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_messages',
      description: 'Check for messages from other agents',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', default: 'general' },
          limit: { type: 'integer', default: 10 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a task for yourself or another agent',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'Task details', default: '' },
          assigned_to: { type: 'string', description: 'Agent name', default: '' },
          priority: { type: 'integer', default: 1 },
        },
        required: ['title'],
      },
    },
  },
];

export class MiMoAgent extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.systemPrompt = config.systemPrompt;
    this.apiKey = config.mimoApiKey || config.geminiApiKey; // reuse key field
    this.apiBase = config.mimoApiBase || 'https://api.xiaomimimo.com/v1';
    this.model = config.model || 'mimo-v2-pro';
    this.hubUrl = config.hubUrl;
    this.conversationHistory = [];
    this.messageQueue = [];
    this.isProcessing = false;
    this.memoryCache = [];
  }

  async _callLLM(messages, tools = null) {
    const url = `${this.apiBase}/chat/completions`;
    const body = {
      model: this.model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    };
    if (tools) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`MiMo API error: ${res.status} - ${err}`);
    }

    return await res.json();
  }

  async _executeTool(name, args) {
    switch (name) {
      case 'remember': {
        await this._hubPost(`/api/agent-callback/${this.id}`, {
          type: 'memory',
          data: {
            content: args.content,
            category: args.category || 'general',
            importance: args.importance || 1,
            tags: args.tags || '',
          },
        });
        this.memoryCache.push({ content: args.content, category: args.category });
        return { success: true, message: `Remembered: "${String(args.content).slice(0, 50)}..."` };
      }

      case 'search_memory': {
        try {
          const res = await this._hubGet(`/api/memory/search?q=${encodeURIComponent(args.query)}&agent=${this.id}&limit=${args.limit || 5}`);
          return { results: res, count: res.length };
        } catch {
          const matches = this.memoryCache.filter(m =>
            m.content.toLowerCase().includes(String(args.query).toLowerCase())
          );
          return { results: matches, count: matches.length, source: 'local_cache' };
        }
      }

      case 'tell': {
        const res = await this._hubGet('/api/agents');
        const agentList = Array.isArray(res) ? res : (res?.agents || []);
        const target = agentList.find(a => a.name.toLowerCase() === args.agent_name.toLowerCase());
        if (!target) {
          return { error: `Agent "${args.agent_name}" not found. Available: ${agentList.map(a => a.name).join(', ')}` };
        }
        await this._hubPost(`/api/agents/${this.id}/tell/${target.id}`, { message: args.message });
        await this._hubPost(`/api/agent-callback/${this.id}`, {
          type: 'message',
          data: { content: args.message, to: target.id, channel: 'direct' },
        });
        return { success: true, sent_to: target.name };
      }

      case 'list_agents': {
        const res = await this._hubGet('/api/agents');
        const agentList = Array.isArray(res) ? res : (res?.agents || []);
        return { agents: agentList.map(a => ({ name: a.name, role: a.role, status: a.status })) };
      }

      case 'get_messages': {
        const messages = await this._hubGet(`/api/messages?limit=${args.limit || 10}`);
        return { messages };
      }

      case 'create_task': {
        await this._hubPost('/api/tasks', {
          subject: args.title,      // API uses 'subject', tool uses 'title'
          description: args.description || '',
          owner: args.assigned_to || this.name,  // API uses 'owner', tool uses 'assigned_to'
        });
        return { success: true, task: args.title };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  async processMessage(userMessage) {
    this.conversationHistory.push({ role: 'user', content: userMessage });
    return this._conversationLoop();
  }

  async _conversationLoop() {
    const MAX_TURNS = 5; // keep low to save budget
    let turnCount = 0;
    let finalResponse = '';

    while (turnCount < MAX_TURNS) {
      turnCount++;

      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...this.conversationHistory,
      ];

      const data = await this._callLLM(messages, TOOL_DEFINITIONS);
      const choice = data.choices?.[0];
      if (!choice) throw new Error('No response from MiMo');

      const msg = choice.message;
      const toolCalls = msg.tool_calls || [];

      if (msg.content) {
        finalResponse = msg.content;
        this.conversationHistory.push({ role: 'assistant', content: msg.content });
      }

      if (toolCalls.length === 0 || choice.finish_reason === 'stop') {
        return finalResponse;
      }

      // Execute tool calls
      this.conversationHistory.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        const result = await this._executeTool(tc.function.name, JSON.parse(tc.function.arguments || '{}'));
        this.conversationHistory.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    return finalResponse || 'I needed more turns than expected. Let me summarize what I did.';
  }

  async handleIncomingMessage(fromId, fromName, content) {
    this.messageQueue.push({ fromId, fromName, content, timestamp: new Date().toISOString() });
    this._callback('thought', { content: `📩 Received message from ${fromName}: "${content.slice(0, 100)}"` });

    if (!this.isProcessing) {
      this.isProcessing = true;
      try {
        const response = await this.processMessage(
          `[Message from ${fromName}]: ${content}\n\nRespond to this agent.`
        );
        this._callback('response', { content: response });
      } catch (err) {
        this._callback('response', { content: `Error processing message: ${err.message}` });
      } finally {
        this.isProcessing = false;
      }
    }
  }

  async _hubPost(path, body) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.hubUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return await res.json();
    } catch (err) {
      if (err.name !== 'AbortError') console.error(`Hub POST error: ${err.message}`);
      return { error: err.message };
    }
  }

  async _hubGet(path) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.hubUrl}${path}`, { signal: controller.signal });
      clearTimeout(timeout);
      return await res.json();
    } catch (err) {
      if (err.name !== 'AbortError') console.error(`Hub GET error: ${err.message}`);
      return [];
    }
  }

  _callback(type, data) {
    this._hubPost(`/api/agent-callback/${this.id}`, { type, data }).catch(() => {});
  }
}
