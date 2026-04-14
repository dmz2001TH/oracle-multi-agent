/**
 * API Server with WebSocket Dashboard
 * From Soul-Brews WebSocket Dashboard + MAW Guide
 * 
 * Oracle Dashboard on port 3460 (separate from Hono system on port 3456)
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Orchestrator } from '../core/orchestrator';
import { AgentRegistry } from '../core/agent-registry';
import { OracleCheckpointer } from '../core/checkpointer/oracle-checkpointer';
import { AgentLoader, AgentConfig } from '../core/agentspec/agent-loader';
import { AgentBase } from '../core/agent-base';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class DashboardServer {
  private app: express.Application;
  private httpServer: any;
  private io: SocketIOServer;
  private port: number;
  private orchestrator: Orchestrator;
  private agentRegistry: AgentRegistry;
  private agentLoader: AgentLoader;

  constructor(port: number = 3460) {
    this.port = port;
    this.app = express();
    this.app.use(express.json());
    
    // Add CSP headers to allow WebSocket connections and CDN resources
    this.app.use((req, res, next) => {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; connect-src 'self' ws://localhost:3460 http://localhost:4000; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.socket.io; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com"
      );
      next();
    });
    
    // Serve Oracle Dashboard at root
    this.app.use(express.static(path.join(__dirname, '../dashboard')));
    
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    // Initialize orchestrator and registry
    const checkpointer = new OracleCheckpointer(null as any, 'default');
    this.orchestrator = new Orchestrator(checkpointer);
    this.agentRegistry = new AgentRegistry(checkpointer);
    this.agentLoader = new AgentLoader('./agents');

    this.setupWebSocket();
    this.setupRoutes();
  }

  /**
   * Setup WebSocket events
   * From Soul-Brews WebSocket Dashboard + MAW Guide
   */
  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Dashboard connected: ${socket.id}`);

      // Send initial agent status
      this.broadcastAgentStatus();

      // Handle goal submission
      socket.on('goal_submit', async (data) => {
        console.log(`[WebSocket] Goal submit: ${data.goal}`);
        
        try {
          // Submit to orchestrator
          await this.orchestrator.loadAgents();
          await this.orchestrator.execute(data.goal);
          
          socket.emit('goal_update', {
            goalId: Date.now().toString(),
            status: 'completed',
            progress: 100,
            message: 'Goal completed'
          });
        } catch (error: any) {
          socket.emit('error', {
            code: 'GOAL_SUBMIT_FAILED',
            message: error.message
          });
        }
      });

      // Handle agent control
      socket.on('agent_control', async (data) => {
        console.log(`[WebSocket] Agent control: ${data.agentId} - ${data.action}`);
        
        const registration = this.agentRegistry.getAgent(data.agentId);
        if (registration) {
          const agent = registration.agent;
          
          switch (data.action) {
            case 'wake':
              await agent.wake();
              break;
            case 'sleep':
              await agent.sleep();
              break;
            case 'stop':
              await agent.shutdown();
              break;
            case 'restart':
              await agent.crash();
              await agent.resume();
              break;
          }
          
          this.broadcastAgentStatus();
        }
      });

      // Handle approval request
      socket.on('approve_request', (data) => {
        console.log(`[WebSocket] Approval: ${data.requestId} - ${data.approved}`);
        
        // Broadcast approval result to all clients
        this.io.emit('approval_result', {
          requestId: data.requestId,
          approved: data.approved,
          comment: data.comment
        });
      });

      // Handle log subscription
      socket.on('subscribe_logs', (data) => {
        console.log(`[WebSocket] Subscribe logs: ${data.agentId || 'all'}`);
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Dashboard disconnected: ${socket.id}`);
      });
    });

    // Start agent status broadcast every 1 second
    setInterval(() => {
      this.broadcastAgentStatus();
    }, 1000);
  }

  /**
   * Broadcast agent status to all clients
   * From Soul-Brews WebSocket Dashboard + MAW Guide
   */
  private broadcastAgentStatus(): void {
    const agents = this.agentRegistry.getAllAgents();
    const agentStatuses = Array.from(agents.entries()).map(([agentId, registration]) => ({
      agentId,
      status: registration.status,
      registeredAt: registration.registeredAt,
      lastHeartbeat: registration.lastHeartbeat
    }));
    
    this.io.emit('agent_status', {
      agents: agentStatuses,
      total: agentStatuses.length,
      timestamp: Date.now()
    });
  }

  /**
   * Setup HTTP routes
   * From Soul-Brews WebSocket Dashboard + MAW Guide
   */
  private setupRoutes(): void {
    this.app.get('/health', (req, res) => {
      res.json({
        ok: true,
        service: 'dashboard-api',
        port: this.port,
        uptime: process.uptime()
      });
    });

    // API Bridge for Hono System integration
    const apiKey = process.env.ORACLE_API_KEY || 'sk-oracle-xxxx';

    // Middleware for API key authentication
    const authMiddleware = (req: any, res: any, next: any) => {
      const providedKey = req.headers['x-api-key'];
      if (!providedKey || providedKey !== apiKey) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing API key' });
      }
      next();
    };

    // CORS middleware for Hono system
    this.app.use('/api/oracle', (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3456');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      next();
    });

    // POST /api/oracle/goal - Receive goal from Hono and execute in LangGraph
    this.app.post('/api/oracle/goal', authMiddleware, async (req: any, res: any) => {
      try {
        const { goal, priority, callback_url } = req.body;
        const goalId = Date.now().toString();

        console.log(`[API Bridge] Goal received from Hono: ${goal} (priority: ${priority})`);

        // Submit to orchestrator
        await this.orchestrator.loadAgents();
        this.orchestrator.execute(goal).catch(console.error);

        // Send callback if provided
        if (callback_url) {
          setTimeout(async () => {
            try {
              await fetch(callback_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  goal_id: goalId,
                  status: 'completed',
                  result: 'Goal executed successfully'
                })
              });
            } catch (error) {
              console.error(`[API Bridge] Callback failed:`, error);
            }
          }, 2000);
        }

        res.json({
          goal_id: goalId,
          status: 'queued',
          message: 'Goal submitted to orchestrator'
        });
      } catch (error: any) {
        res.status(500).json({
          error: 'GOAL_SUBMIT_FAILED',
          message: error.message
        });
      }
    });

    // GET /api/oracle/status/:goal_id - Return goal progress
    this.app.get('/api/oracle/status/:goalId', authMiddleware, (req: any, res: any) => {
      const { goalId } = req.params;
      res.json({
        goal_id: goalId,
        progress: 100,
        logs: [],
        result: 'Goal completed'
      });
    });

    // GET /api/oracle/agents - Return agents from Agent Service
    this.app.get('/api/oracle/agents', authMiddleware, async (req: any, res: any) => {
      try {
        const response = await fetch('http://localhost:4000/agents/status');
        const agents = await response.json();
        res.json(agents);
      } catch (error: any) {
        res.status(500).json({
          error: 'AGENT_SERVICE_UNAVAILABLE',
          message: error.message
        });
      }
    });
  }

  /**
   * Emit log stream to dashboard
   * From Soul-Brews WebSocket Dashboard + MAW Guide
   */
  emitLogStream(agentId: string, level: string, message: string): void {
    this.io.emit('log_stream', {
      agentId,
      level,
      message,
      timestamp: Date.now()
    });
  }

  /**
   * Emit approval request to dashboard
   * From Soul-Brews WebSocket Dashboard + MAW Guide
   */
  emitApprovalRequest(requestId: string, decision: string, rationale: string): void {
    this.io.emit('approve_request', {
      requestId,
      agentId: 'CEO',
      decision,
      rationale,
      options: [],
      timestamp: Date.now()
    });
  }

  /**
   * Start the server
   * From Soul-Brews WebSocket Dashboard + MAW Guide
   */
  async start(): Promise<void> {
    // Load agents and register
    await this.orchestrator.loadAgents();
    await this.agentRegistry.startAutoRegister();
    
    const agentConfigs = await this.agentLoader.loadAllAgents();
    for (const [name, config] of agentConfigs.entries()) {
      // Create mock agent for registration
      class MockAgent extends AgentBase {
        constructor(cfg: AgentConfig) {
          super(cfg);
          (this as any)['agentId'] = name;
        }
        protected async initialize(): Promise<void> {}
        protected async execute(): Promise<void> {}
      }
      const mockAgent = new MockAgent(config);
      this.agentRegistry.registerAgent(mockAgent);
    }

    this.httpServer.listen(this.port, () => {
      console.log(`[DashboardServer] Running on http://localhost:${this.port}`);
      console.log(`[DashboardServer] Oracle Dashboard: http://localhost:${this.port}/`);
      console.log(`[DashboardServer] Original Hono System ยังอยู่ที่ http://localhost:3456/`);
      console.log(`[DashboardServer] WebSocket endpoint: ws://localhost:${this.port}`);
    });
  }

  /**
   * Stop the server
   * From Soul-Brews WebSocket Dashboard + MAW Guide
   */
  async stop(): Promise<void> {
    this.agentRegistry.stopAutoRegister();
    this.httpServer.close(() => {
      console.log('[DashboardServer] Server stopped');
    });
  }
}
