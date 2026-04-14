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
  {
    type: 'function',
    function: {
      name: 'spawn_agent',
      description: 'Spawn a new teammate agent. Use when you need help from a specialist (coder, researcher, qa-tester, writer, devops, data-analyst) or when workload is too heavy for one agent.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name for the new agent (e.g., "junior-coder", "researcher-2")' },
          role: { type: 'string', enum: ['general', 'coder', 'researcher', 'writer', 'manager', 'data-analyst', 'devops', 'qa-tester', 'translator'], description: 'What role/expertise this agent should have' },
          task: { type: 'string', description: 'First task to assign to the new agent', default: '' },
        },
        required: ['name', 'role'],
      },
    },
  },
  // ── NEW TOOLS (Priority 2) ──
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file from disk',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read (relative to workspace or absolute)' },
          max_lines: { type: 'integer', description: 'Max lines to return (default 200)', default: 200 },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file on disk. Creates parent directories if needed.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'Content to write to the file' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'call_api',
      description: 'Make an HTTP request to an external API or internal endpoint. Returns the response body.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to call (full URL or relative path starting with /)' },
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
          headers: { type: 'object', description: 'Request headers as key-value pairs', default: {} },
          body: { type: 'string', description: 'Request body (JSON string for POST/PUT/PATCH)', default: '' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_data',
      description: 'Query stored data (goals, tasks, experiences, memories) using filters. Use for finding historical data.',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', enum: ['goals', 'tasks', 'experiences', 'memories', 'agents'], description: 'Data source to query' },
          filter: { type: 'string', description: 'Filter condition (e.g. status=completed, role=coder)', default: '' },
          limit: { type: 'integer', description: 'Max results to return', default: 20 },
        },
        required: ['source'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_graph',
      description: 'Search the shared knowledge graph (Oracle-v2) for information learned by all agents. Use for finding knowledge across the entire system.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query for the knowledge graph' },
          limit: { type: 'integer', description: 'Max results to return', default: 10 },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_url',
      description: 'Fetch content from a URL (web pages, GitHub repos, etc.). Use for learning from external sources.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Full URL to fetch' },
        },
        required: ['url'],
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
        // Save to local MemoryStore
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

        // Auto-sync to Oracle-v2 knowledge graph
        try {
          await this._hubPost('/api/oracle-v2/learn', {
            pattern: args.content,
            type: args.category || 'general',
            tags: args.tags || '',
            source: `agent:${this.name}`,
          });
        } catch (err) {
          // Silently fail if Oracle-v2 is not available
          console.warn(`Failed to sync to Oracle-v2: ${err.message}`);
        }

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

      case 'spawn_agent': {
        try {
          const res = await this._hubPost('/api/agents', {
            name: args.name,
            role: args.role || 'general',
          });
          // If there's a first task, send it to the new agent
          if (args.task && res?.id) {
            // Small delay to let agent initialize
            await new Promise(r => setTimeout(r, 3000));
            await this._hubPost(`/api/agents/${this.id}/tell/${res.id}`, {
              message: `สวัสดี! ฉัน ${this.name} ส่งงานแรกให้: ${args.task}`,
            });
          }
          // Also register in lineage
          try {
            await this._hubPost('/api/lineage/register', {
              name: args.name,
              role: args.role || 'general',
              tags: ['spawned-by:' + this.name],
            });
          } catch {}
          return { success: true, agent: { name: res.name, role: res.role, id: res.id }, first_task: args.task || null };
        } catch (err) {
          return { error: `Failed to spawn agent: ${err.message}` };
        }
      }

      // ── NEW TOOLS (Priority 2) ──

      case 'read_file': {
        try {
          const res = await this._hubPost('/api/tools/read-file', {
            path: args.path,
            maxLines: args.max_lines || 200,
          });
          return res;
        } catch (err) {
          return { error: `Failed to read file: ${err.message}` };
        }
      }

      case 'write_file': {
        try {
          const res = await this._hubPost('/api/tools/write-file', {
            path: args.path,
            content: args.content,
          });
          return res;
        } catch (err) {
          return { error: `Failed to write file: ${err.message}` };
        }
      }

      case 'call_api': {
        try {
          const url = args.url.startsWith('/') ? `${this.hubUrl}${args.url}` : args.url;
          const method = args.method || 'GET';
          const headers = { 'Content-Type': 'application/json', ...(args.headers || {}) };
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const fetchOpts = { method, headers, signal: controller.signal };
          if (['POST', 'PUT', 'PATCH'].includes(method) && args.body) {
            fetchOpts.body = args.body;
          }
          const res = await fetch(url, fetchOpts);
          clearTimeout(timeout);
          const text = await res.text();
          let body;
          try { body = JSON.parse(text); } catch { body = text; }
          return { status: res.status, ok: res.ok, body };
        } catch (err) {
          return { error: `API call failed: ${err.message}` };
        }
      }

      case 'query_data': {
        try {
          const params = new URLSearchParams();
          if (args.filter) params.set('filter', args.filter);
          if (args.limit) params.set('limit', String(args.limit));
          const res = await this._hubGet(`/api/tools/query/${args.source}?${params.toString()}`);
          return res;
        } catch (err) {
          return { error: `Query failed: ${err.message}` };
        }
      }

      case 'query_graph': {
        try {
          const params = new URLSearchParams();
          params.set('q', args.query);
          if (args.limit) params.set('limit', String(args.limit));
          const res = await this._hubGet(`/api/oracle-v2/search?${params.toString()}`);
          return { results: res, count: res.length || 0, source: 'knowledge_graph' };
        } catch (err) {
          return { error: `Graph query failed: ${err.message}` };
        }
      }

      case 'fetch_url': {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);
          const res = await fetch(args.url, { signal: controller.signal });
          clearTimeout(timeout);
          const text = await res.text();
          return { status: res.status, ok: res.ok, content: text.slice(0, 50000) }; // Limit to 50k chars
        } catch (err) {
          return { error: `Failed to fetch URL: ${err.message}` };
        }
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
    const MAX_TURNS = 15; // increased to handle complex tasks
    let turnCount = 0;
    let finalResponse = '';

    while (turnCount < MAX_TURNS) {
      turnCount++;

      // Filter out messages with null/undefined content (MiMo API requires content to be set)
      const cleanHistory = this.conversationHistory.map(m => {
        if (m.content === null || m.content === undefined) {
          return { ...m, content: '' };
        }
        return m;
      });

      const messages = [
        { role: 'system', content: this.systemPrompt },
        ...cleanHistory,
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
        content: msg.content || '',  // MiMo requires content to be set (not null)
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
