#!/usr/bin/env node
const config = JSON.parse(process.env.AGENT_CONFIG);

// Select LLM provider
let Agent;
if (config.provider === 'promptdee') {
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

// Load initial memories
const loadInitialMemories = async () => {
  try {
    const memories = await agent._hubGet(`/api/memory/all?limit=20`);
    if (Array.isArray(memories)) {
      agent.memoryCache = memories.map(m => ({ content: m.content, category: m.category }));
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

// Phase 5: Periodic state save every 30s
let stateSaveInterval = setInterval(() => {
  process.send({
    type: 'state_update',
    conversationHistory: agent.conversationHistory.slice(-20),
    memoryCache: agent.memoryCache.slice(-20),
  });
}, 30000);

// Handle messages from parent (Hub)
process.on('message', async (msg) => {
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'chat': {
      agent.isProcessing = true;
      agent._callback('status', { status: 'thinking' });

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
      // Phase 3: Auto-communication — handle assigned task
      console.log(`📋 ${agent.name} received task: ${msg.title}`);
      agent._callback('status', { status: 'working' });
      try {
        const result = await agent.processMessage(
          `TASK ASSIGNED: ${msg.title}\n${msg.description || ''}\n\nComplete this task and report your results.`
        );
        // Report task completion
        process.send({
          type: 'task_completed',
          taskId: msg.taskId,
          result: result,
        });
        agent._callback('response', { content: result });
      } catch (err) {
        process.send({
          type: 'task_completed',
          taskId: msg.taskId,
          result: `Error: ${err.message}`,
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
