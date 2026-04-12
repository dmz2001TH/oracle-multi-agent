// Alternative LLM client using promptdee.net API
// Free tier: 5.00 credits/day, gpt-4o-mini model
// API: POST https://www.promptdee.net/api/ai-chat
// Body: {"message": "your message"}

import { EventEmitter } from 'events';

const PROMPTDEE_API = 'https://www.promptdee.net/api/ai-chat';

// Simplified tool descriptions for the LLM
const TOOL_INSTRUCTIONS = `
You have access to these tools. Call them by responding with JSON:
{"tool": "remember", "args": {"content": "...", "category": "general", "importance": 1, "tags": "..."}}
{"tool": "search_memory", "args": {"query": "...", "limit": 5}}
{"tool": "tell", "args": {"agent_name": "...", "message": "..."}}
{"tool": "list_agents", "args": {}}
{"tool": "get_messages", "args": {"channel": "general", "limit": 10}}
{"tool": "create_task", "args": {"title": "...", "description": "...", "assigned_to": "...", "priority": 1}}

IMPORTANT: When you want to use a tool, respond ONLY with the JSON tool call (no extra text).
When responding to the user normally, respond with plain text (no JSON).
`;

export class PromptDeeAgent extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.systemPrompt = config.systemPrompt;
    this.hubUrl = config.hubUrl;
    this.conversationHistory = [];
    this.memoryCache = [];
    this.isProcessing = false;
  }

  async _callLLM(userMessage) {
    // Build context: system prompt + recent history + current message
    let context = `${this.systemPrompt}\n\n${TOOL_INSTRUCTIONS}`;

    // Add recent conversation history (last 5 exchanges)
    const recentHistory = this.conversationHistory.slice(-10);
    if (recentHistory.length > 0) {
      context += '\n\nRecent conversation:\n';
      for (const msg of recentHistory) {
        if (msg.role === 'user') {
          context += `User: ${msg.content}\n`;
        } else {
          context += `${this.name}: ${msg.content}\n`;
        }
      }
    }

    // Add memories
    if (this.memoryCache.length > 0) {
      context += '\n\nYour memories:\n';
      for (const mem of this.memoryCache.slice(-10)) {
        context += `- ${mem.content}\n`;
      }
    }

    const fullMessage = `${context}\n\nUser: ${userMessage}`;

    const res = await fetch(PROMPTDEE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: fullMessage }),
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.userMessage || 'API error');
    }

    return data.response;
  }

  async _executeTool(toolCall) {
    const { tool, args } = toolCall;

    switch (tool) {
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
        return `✅ Remembered: "${args.content.slice(0, 50)}..."`;
      }

      case 'search_memory': {
        try {
          const res = await this._hubGet(`/api/memory/search?q=${encodeURIComponent(args.query)}&limit=${args.limit || 5}`);
          if (Array.isArray(res) && res.length > 0) {
            return res.map(m => `- ${m.content}`).join('\n');
          }
          return 'No memories found.';
        } catch {
          const matches = this.memoryCache.filter(m =>
            m.content.toLowerCase().includes(args.query.toLowerCase())
          );
          return matches.length > 0
            ? matches.map(m => `- ${m.content}`).join('\n')
            : 'No memories found.';
        }
      }

      case 'tell': {
        const agents = await this._hubGet('/api/agents');
        const target = agents.find(a => a.name.toLowerCase() === args.agent_name.toLowerCase());
        if (!target) {
          return `Agent "${args.agent_name}" not found. Available: ${agents.map(a => a.name).join(', ')}`;
        }
        await this._hubPost(`/api/agents/${this.id}/tell/${target.id}`, {
          message: args.message,
        });
        return `✅ Message sent to ${target.name}`;
      }

      case 'list_agents': {
        const agents = await this._hubGet('/api/agents');
        return agents.map(a => `${a.name} (${a.role}) - ${a.status}`).join('\n');
      }

      case 'get_messages': {
        const channel = args.channel || 'general';
        const messages = await this._hubGet(`/api/messages/${channel}?limit=${args.limit || 10}`);
        if (Array.isArray(messages) && messages.length > 0) {
          return messages.map(m => `[${m.from_agent}]: ${m.content}`).join('\n');
        }
        return 'No messages in this channel.';
      }

      case 'create_task': {
        await this._hubPost('/api/tasks', {
          title: args.title,
          description: args.description || '',
          assignedTo: args.assigned_to || this.name,
          priority: args.priority || 1,
        });
        return `✅ Task created: ${args.title}`;
      }

      default:
        return `Unknown tool: ${tool}`;
    }
  }

  async processMessage(userMessage) {
    this.conversationHistory.push({ role: 'user', content: userMessage });

    let response = await this._callLLM(userMessage);
    let turns = 0;
    const MAX_TURNS = 5;

    // Process tool calls (loop in case agent chains tools)
    while (turns < MAX_TURNS) {
      turns++;

      // Check if response is a tool call (JSON with "tool" key)
      let toolCall = null;
      try {
        const trimmed = response.trim();
        if (trimmed.startsWith('{') && trimmed.includes('"tool"')) {
          toolCall = JSON.parse(trimmed);
        }
      } catch {
        // Not a tool call, just a regular response
      }

      if (!toolCall || !toolCall.tool) {
        // Regular text response
        this.conversationHistory.push({ role: 'assistant', content: response });
        return response;
      }

      // Execute tool
      console.log(`🔧 ${this.name} calling: ${toolCall.tool}(${JSON.stringify(toolCall.args).slice(0, 80)})`);
      const toolResult = await this._executeTool(toolCall);

      // Get next response from LLM with tool result
      response = await this._callLLM(
        `${userMessage}\n\n[Tool result for ${toolCall.tool}]: ${toolResult}\n\nNow respond to the user with this information.`
      );
    }

    this.conversationHistory.push({ role: 'assistant', content: response });
    return response;
  }

  async handleIncomingMessage(fromId, fromName, content) {
    this._callback('thought', {
      content: `📩 Message from ${fromName}: "${content.slice(0, 100)}"`,
    });

    if (!this.isProcessing) {
      this.isProcessing = true;
      try {
        const response = await this.processMessage(
          `[Message from ${fromName}]: ${content}\n\nRespond to this agent.`
        );
        this._callback('response', { content: response });
      } catch (err) {
        this._callback('response', { content: `Error: ${err.message}` });
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
