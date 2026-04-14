#!/usr/bin/env node
const config = JSON.parse(process.env.AGENT_CONFIG);

// Select LLM provider
let Agent;
if (config.provider === 'mimo') {
  const mod = await import('./mimo-client.js');
  Agent = mod.MiMoAgent;
  console.log(`🤖 Agent "${config.name}" using MiMo API (${config.model})`);
} else if (config.provider === 'promptdee') {
  const mod = await import('./promptdee-client.js');
  Agent = mod.PromptDeeAgent;
  console.log(`🤖 Agent "${config.name}" using PromptDee API (gpt-4o-mini)`);
} else {
  const mod = await import('./gemini-client.js');
  Agent = mod.GeminiAgent;
  console.log(`🤖 Agent "${config.name}" using Gemini API (${config.model})`);
}

const agent = new Agent(config);

console.log(`🤖 Agent "${config.name}" (${config.role}) starting...`);

// Report to hub that we're alive
agent._callback('status', { status: 'active' });

// Load initial memories — load ALL memories for this agent
const loadInitialMemories = async () => {
  try {
    // Load all memories (conversation + general)
    const memories = await agent._hubGet(`/api/memory/all?limit=500`);
    if (Array.isArray(memories)) {
      agent.memoryCache = memories.map(m => ({ content: m.content, category: m.category }));
      console.log(`📂 Loaded ${memories.length} memories from store`);
    }
  } catch (err) {
    console.warn(`⚠️ Could not load memories: ${err.message}`);
  }
};

// Phase 5: Restore saved state
if (config.savedState) {
  if (config.savedState.conversationHistory?.length > 0) {
    agent.conversationHistory = config.savedState.conversationHistory;
    console.log(`📂 Restored ${agent.conversationHistory.length} conversation entries`);
  }
  if (config.savedState.memoryCache?.length > 0) {
    agent.memoryCache = config.savedState.memoryCache;
    console.log(`📂 Restored ${agent.memoryCache.length} cached memories`);
  }
  if (config.savedState.messageQueue?.length > 0) {
    agent.messageQueue = config.savedState.messageQueue;
    console.log(`📂 Restored ${agent.messageQueue.length} queued messages`);
  }
}

await loadInitialMemories();

// Phase 3: Message polling — check for new messages every 15s
let messagePollInterval = setInterval(async () => {
  try {
    const unread = await agent._hubGet(`/api/messages?limit=5`);
    if (Array.isArray(unread) && unread.length > 0) {
      const recent = unread.filter(m =>
        m.to_agent === agent.id && !m.read && m.from_agent !== agent.id
      );
      if (recent.length > 0) {
        console.log(`📬 ${agent.name}: ${recent.length} new message(s)`);
        for (const msg of recent) {
          agent._callback('thought', { content: `New message from ${msg.from_agent}: ${msg.content.slice(0, 80)}` });
        }
      }
    }
  } catch {}
}, 15000);

// Phase 5: Periodic state save every 30s — save FULL history (not sliced)
let stateSaveInterval = setInterval(() => {
  try {
    if (process.connected) {
      process.send({
        type: 'state_update',
        conversationHistory: agent.conversationHistory,       // บันทึกทั้งหมด
        memoryCache: agent.memoryCache,                       // บันทึกทั้งหมด
      });
    }
  } catch {}
}, 30000);

// Handle messages from parent (Hub)
process.on('message', async (msg) => {
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'chat': {
      agent.isProcessing = true;
      agent._callback('status', { status: 'thinking' });

      // Auto-save user message to permanent memory
      try {
        agent._callback('memory', {
          content: `[User] ${msg.content}`,
          category: 'conversation',
          importance: 2,
          tags: 'chat,user',
        });
      } catch {}

      try {
        const response = await agent.processMessage(msg.content);

        // Send response back to hub
        process.send({
          type: 'response',
          messageId: msg.messageId,
          content: response,
        });

        agent._callback('response', { content: response });
        agent._callback('status', { status: 'active' });

        // Auto-save assistant response to permanent memory
        try {
          agent._callback('memory', {
            content: `[${agent.config?.name || 'Agent'}] ${response}`,
            category: 'conversation',
            importance: 2,
            tags: 'chat,agent,response',
          });
        } catch {}
      } catch (err) {
        process.send({
          type: 'response',
          messageId: msg.messageId,
          content: `Error: ${err.message}`,
        });
        agent._callback('status', { status: 'active' });
      } finally {
        agent.isProcessing = false;
      }
      break;
    }

    case 'incoming_message': {
      await agent.handleIncomingMessage(msg.from, msg.fromName, msg.content);
      break;
    }

    case 'task': {
      // Phase 3 + Autonomous: handle assigned task with planning loop
      console.log(`📋 ${agent.name} received task: ${msg.title}`);
      agent._callback('status', { status: 'thinking' });

      // THINK phase — analyze the task
      const thinkPrompt = [
        `TASK: ${msg.title}`,
        msg.description ? `Description: ${msg.description}` : '',
        msg.goalId ? `Goal ID: ${msg.goalId}` : '',
        '',
        'Before executing, analyze:',
        '1. What is the expected outcome?',
        '2. What tools/approach do I need?',
        '3. What could go wrong?',
        '4. Do I have enough context?',
        '',
        'Then execute the task and report results.',
      ].filter(Boolean).join('\n');

      try {
        // PLAN + ACT phase — process with LLM
        agent._callback('status', { status: 'working' });
        const result = await agent.processMessage(thinkPrompt);

        // OBSERVE phase — check if result looks successful
        const success = !result.toLowerCase().includes('error') && result.length > 10;

        // REFLECT phase — record experience
        agent._callback('memory', {
          content: `Task: ${msg.title} — ${success ? 'SUCCESS' : 'FAILED'} — ${result.slice(0, 200)}`,
          category: 'experience',
          importance: success ? 3 : 5,
          tags: `task,${success ? 'success' : 'failure'},autonomous`,
        });

        // Report task completion
        process.send({
          type: 'task_completed',
          taskId: msg.taskId,
          result: result,
          success: success,
        });
        agent._callback('response', { content: result });
      } catch (err) {
        // Self-healing: record failure for learning
        agent._callback('memory', {
          content: `Task FAILED: ${msg.title} — Error: ${err.message}`,
          category: 'failure',
          importance: 5,
          tags: 'task,failure,self-healing',
        });

        process.send({
          type: 'task_completed',
          taskId: msg.taskId,
          result: `Error: ${err.message}`,
          success: false,
        });
      } finally {
        agent._callback('status', { status: 'active' });
      }
      break;
    }

    case 'shutdown': {
      console.log(`🤖 Agent "${config.name}" shutting down...`);
      clearInterval(messagePollInterval);
      clearInterval(stateSaveInterval);
      agent._callback('status', { status: 'stopped' });

      // Save session summary
      try {
        agent._callback('memory', {
          content: `Session ended. ${agent.conversationHistory.length} messages exchanged.`,
          category: 'session',
          importance: 1,
          tags: 'session,end',
        });
      } catch {}

      setTimeout(() => process.exit(0), 500);
      break;
    }

    default:
      console.warn(`Unknown message type: ${msg.type}`);
  }
});

// Keep alive
process.on('uncaughtException', (err) => {
  console.error(`❌ Agent "${config.name}" uncaught:`, err);
  agent._callback('status', { status: 'error' });
});

console.log(`✅ Agent "${config.name}" ready`);
