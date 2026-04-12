#!/usr/bin/env node
import { GeminiAgent } from './gemini-client.js';

const config = JSON.parse(process.env.AGENT_CONFIG);

const agent = new GeminiAgent(config);

console.log(`🤖 Agent "${config.name}" (${config.role}) starting...`);

// Report to hub that we're alive
agent._callback('status', { status: 'active' });

// Load initial memories
const loadInitialMemories = async () => {
  try {
    const memories = await agent._hubGet(`/api/memory/search?q=agent:${config.name}&limit=20`);
    if (Array.isArray(memories)) {
      agent.memoryCache = memories.map(m => ({ content: m.content, category: m.category }));
    }
  } catch {}
};

await loadInitialMemories();

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

    case 'shutdown': {
      console.log(`🤖 Agent "${config.name}" shutting down...`);
      agent._callback('status', { status: 'stopped' });

      // Save session summary
      agent._callback('memory', {
        content: `Session ended. ${agent.conversationHistory.length} messages exchanged.`,
        category: 'session',
        importance: 1,
        tags: 'session,end',
      });

      setTimeout(() => process.exit(0), 1000);
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
