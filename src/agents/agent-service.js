#!/usr/bin/env node
/**
 * Persistent Agent Service
 * 
 * This script runs an agent as a standalone service that persists
 * across backend restarts. It exposes an HTTP endpoint for the backend
 * to discover and communicate with the agent.
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

// Parse command line arguments
const args = process.argv.slice(2);
const agentName = args[0] || 'Oracle';
const agentRole = args[1] || 'general';
const agentPersonality = args[2] || '';
const agentPort = args[3] ? parseInt(args[3]) : 4000;

// Load environment variables
const config = {
  id: uuidv4(),
  name: agentName,
  role: agentRole,
  personality: agentPersonality,
  provider: process.env.LLM_PROVIDER || 'mimo',
  model: process.env.AGENT_MODEL || 'mimo-v2-pro',
  mimoApiKey: process.env.MIMO_API_KEY || '',
  mimoApiBase: process.env.MIMO_API_BASE || 'https://api.xiaomimimo.com/v1',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  port: agentPort,
  backendUrl: `http://localhost:3456`,
};

// Create Express app
const app = express();
app.use(express.json());

// Agent state
let agentInstance = null;
let isRunning = false;

// Agent registration with backend
const registerWithBackend = async () => {
  try {
    const response = await fetch(`${config.backendUrl}/api/v2/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: config.id,
        name: config.name,
        role: config.role,
        personality: config.personality || '',
        serviceUrl: `http://localhost:${config.port}`,
        status: 'running',
      }),
    });
    if (response.ok) {
      console.log(`✅ Registered with backend`);
    } else {
      const errorText = await response.text();
      console.warn(`⚠️ Failed to register with backend: ${response.statusText} - ${errorText}`);
    }
  } catch (err) {
    console.warn(`⚠️ Could not register with backend: ${err.message}`);
  }
};

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    agent: config.name,
    role: config.role,
    id: config.id,
    status: isRunning ? 'running' : 'stopped',
    uptime: process.uptime(),
  });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    if (!agentInstance) {
      return res.status(400).json({ error: 'Agent is not initialized' });
    }
    
    // Forward to the agent's chat method
    // The agent instance should have a method to handle messages
    // For now, return a simple response
    res.json({
      agent: config.name,
      response: `[${config.role}] Received: ${message}`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    id: config.id,
    name: config.name,
    role: config.role,
    personality: config.personality,
    status: isRunning ? 'running' : 'stopped',
    uptime: process.uptime(),
  });
});

// Initialize agent
const initializeAgent = async () => {
  try {
    // Load the appropriate agent client
    let Agent;
    if (config.provider === 'mimo') {
      const mod = await import('./mimo-client.js');
      Agent = mod.MiMoAgent;
    } else if (config.provider === 'promptdee') {
      const mod = await import('./promptdee-client.js');
      Agent = mod.PromptDeeAgent;
    } else {
      const mod = await import('./gemini-client.js');
      Agent = mod.GeminiAgent;
    }
    
    agentInstance = new Agent(config);
    isRunning = true;
    console.log(`🤖 Agent "${config.name}" (${config.role}) initialized`);
    
    // Register with backend
    await registerWithBackend();
  } catch (err) {
    console.error(`❌ Failed to initialize agent: ${err.message}`);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  console.log(`🛑 Shutting down agent service...`);
  isRunning = false;
  
  // Unregister from backend
  try {
    await fetch(`${config.backendUrl}/api/v2/agents/${config.id}/unregister`, {
      method: 'POST',
    });
    console.log(`✅ Unregistered from backend`);
  } catch (err) {
    console.warn(`⚠️ Could not unregister from backend: ${err.message}`);
  }
  
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`🚀 Agent Service running on http://localhost:${PORT}`);
  console.log(`🤖 Agent: ${config.name} (${config.role})`);
  console.log(`📡 Provider: ${config.provider} (${config.model})`);
  
  // Initialize agent
  initializeAgent();
});
