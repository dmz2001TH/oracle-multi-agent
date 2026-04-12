import { EventEmitter } from 'events';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const TOOL_DEFINITIONS = [
  {
    name: 'remember',
    description: 'Store a piece of information in long-term memory for future reference',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The information to remember' },
        category: { type: 'string', description: 'Category: general, identity, task, learning, conversation, code, project', default: 'general' },
        importance: { type: 'integer', description: 'Importance 1-5 (5 = critical)', default: 1 },
        tags: { type: 'string', description: 'Comma-separated tags for search', default: '' },
      },
      required: ['content'],
    },
  },
  {
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
  {
    name: 'tell',
    description: 'Send a message to another agent. Use this to collaborate, ask questions, or share information.',
    parameters: {
      type: 'object',
      properties: {
        agent_name: { type: 'string', description: 'Name of the agent to message' },
        message: { type: 'string', description: 'Message to send' },
      },
      required: ['agent_name', 'message'],
    },
  },
  {
    name: 'list_agents',
    description: 'See who else is in the system and what they do',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_messages',
    description: 'Check for messages from other agents or the shared channel',
    parameters: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Channel name or "direct" for DMs', default: 'general' },
        limit: { type: 'integer', description: 'How many messages to retrieve', default: 10 },
      },
    },
  },
  {
    name: 'create_task',
    description: 'Create a task for yourself or another agent',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task details' },
        assigned_to: { type: 'string', description: 'Agent name to assign to (empty for self)', default: '' },
        priority: { type: 'integer', description: 'Priority 1-5', default: 1 },
      },
      required: ['title'],
    },
  },
];

export class GeminiAgent extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.systemPrompt = config.systemPrompt;
    this.apiKey = config.geminiApiKey;
    this.model = config.model || 'gemini-2.0-flash';
    this.hubUrl = config.hubUrl;
    this.conversationHistory = [];
    this.messageQueue = [];
    this.isProcessing = false;
    this.memoryCache = [];
  }

  async _callGemini(contents, tools = null) {
    const url = `${GEMINI_API_BASE}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const body = {
      contents,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
      systemInstruction: {
        parts: [{ text: this.systemPrompt }],
      },
    };

    if (tools) {
      body.tools = [{ functionDeclarations: tools }];
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error: ${res.status} - ${err}`);
    }

    const data = await res.json();
    return data;
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
        // Also cache locally
        this.memoryCache.push({ content: args.content, category: args.category });
        return { success: true, message: `Remembered: "${args.content.slice(0, 50)}..."` };
      }

      case 'search_memory': {
        try {
          const res = await this._hubGet(`/api/memory/search?q=${encodeURIComponent(args.query)}&agent=${this.id}&limit=${args.limit || 5}`);
          return { results: res, count: res.length };
        } catch {
          // Fallback to local cache
          const matches = this.memoryCache.filter(m =>
            m.content.toLowerCase().includes(args.query.toLowerCase())
          );
          return { results: matches, count: matches.length, source: 'local_cache' };
        }
      }

      case 'tell': {
        // Find agent by name
        const agents = await this._hubGet('/api/agents');
        const target = agents.find(a => a.name.toLowerCase() === args.agent_name.toLowerCase());
        if (!target) {
          return { error: `Agent "${args.agent_name}" not found. Available: ${agents.map(a => a.name).join(', ')}` };
        }
        await this._hubPost(`/api/agents/${this.id}/tell/${target.id}`, {
          message: args.message,
        });
        // Store in shared memory
        await this._hubPost(`/api/agent-callback/${this.id}`, {
          type: 'message',
          data: { content: args.message, to: target.id, channel: 'direct' },
        });
        return { success: true, sent_to: target.name };
      }

      case 'list_agents': {
        const agents = await this._hubGet('/api/agents');
        return {
          agents: agents.map(a => ({
            name: a.name,
            role: a.role,
            status: a.status,
          })),
        };
      }

      case 'get_messages': {
        const channel = args.channel || 'general';
        const messages = await this._hubGet(`/api/messages/${channel}?limit=${args.limit || 10}`);
        return { messages, channel };
      }

      case 'create_task': {
        await this._hubPost('/api/tasks', {
          title: args.title,
          description: args.description || '',
          assignedTo: args.assigned_to || this.name,
          priority: args.priority || 1,
        });
        return { success: true, task: args.title };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  async processMessage(userMessage) {
    this.conversationHistory.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    return this._conversationLoop();
  }

  async _conversationLoop() {
    const MAX_TURNS = 10;
    let turnCount = 0;
    let finalResponse = '';

    while (turnCount < MAX_TURNS) {
      turnCount++;

      const response = await this._callGemini(this.conversationHistory, TOOL_DEFINITIONS);
      const candidate = response.candidates?.[0];

      if (!candidate) {
        throw new Error('No response from Gemini');
      }

      const parts = candidate.content?.parts || [];

      // Check for function calls
      const functionCalls = parts.filter(p => p.functionCall);
      const textParts = parts.filter(p => p.text);

      if (textParts.length > 0) {
        finalResponse = textParts.map(p => p.text).join('\n');
        // Add to history
        this.conversationHistory.push({
          role: 'model',
          parts: [{ text: finalResponse }],
        });
      }

      if (functionCalls.length === 0) {
        // No more tool calls, we're done
        return finalResponse;
      }

      // Execute tool calls
      const toolResults = [];
      for (const fc of functionCalls) {
        const result = await this._executeTool(fc.functionCall.name, fc.functionCall.args || {});
        toolResults.push({
          functionResponse: {
            name: fc.functionCall.name,
            response: result,
          },
        });
      }

      // Add tool results to conversation
      this.conversationHistory.push({
        role: 'model',
        parts: functionCalls.map(fc => ({ functionCall: fc.functionCall })),
      });
      this.conversationHistory.push({
        role: 'user',
        parts: toolResults,
      });
    }

    return finalResponse || 'I needed more turns than expected. Let me summarize what I did.';
  }

  async handleIncomingMessage(fromId, fromName, content) {
    // Queue the message
    this.messageQueue.push({ fromId, fromName, content, timestamp: new Date().toISOString() });

    // Notify hub
    this._callback('thought', {
      content: `📩 Received message from ${fromName}: "${content.slice(0, 100)}"`,
    });

    // Auto-respond if not busy
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
      const res = await fetch(`${this.hubUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch (err) {
      console.error(`Hub POST error: ${err.message}`);
      return { error: err.message };
    }
  }

  async _hubGet(path) {
    try {
      const res = await fetch(`${this.hubUrl}${path}`);
      return await res.json();
    } catch (err) {
      console.error(`Hub GET error: ${err.message}`);
      return [];
    }
  }

  _callback(type, data) {
    this._hubPost(`/api/agent-callback/${this.id}`, { type, data }).catch(() => {});
  }
}
