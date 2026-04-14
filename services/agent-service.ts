/**
 * Agent Service - HTTP service with Auto-register
 * From MAW Guide - Auto-register every 10s
 */

import express, { Request, Response } from 'express';
import { AgentRegistry } from '../core/agent-registry';
import { AgentLoader } from '../core/agentspec/agent-loader';
import { OracleCheckpointer } from '../core/checkpointer/oracle-checkpointer';
import { AgentBase } from '../core/agent-base';

export class AgentService {
  private app: express.Application;
  private port: number;
  private registry: AgentRegistry;
  private agentLoader: AgentLoader;
  private server: any;

  constructor(port: number = 4000) {
    this.port = port;
    this.app = express();
    this.app.use(express.json());
    
    // Initialize AgentRegistry
    this.registry = new AgentRegistry();
    this.agentLoader = new AgentLoader('./agents');
    
    this.setupRoutes();
  }

  /**
   * Setup HTTP routes
   * From MAW Guide - Auto-register every 10s
   */
  private setupRoutes(): void {
    // Health endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        ok: true,
        service: 'agent-service',
        port: this.port,
        uptime: process.uptime()
      });
    });

    // Agents status endpoint - returns all agents from registry
    this.app.get('/agents/status', (req: Request, res: Response) => {
      const agents = this.registry.getAllAgents();
      const agentStatuses = Array.from(agents.entries()).map(([agentId, registration]) => ({
        agentId,
        status: registration.status,
        registeredAt: registration.registeredAt,
        lastHeartbeat: registration.lastHeartbeat
      }));
      
      res.json({
        agents: agentStatuses,
        total: agentStatuses.length,
        timestamp: Date.now()
      });
    });

    // Agent status by ID
    this.app.get('/agents/:id/status', (req: Request, res: Response) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const registration = this.registry.getAgent(id);
      
      if (!registration) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      res.json({
        agentId: id,
        status: registration.status,
        registeredAt: registration.registeredAt,
        lastHeartbeat: registration.lastHeartbeat
      });
    });
  }

  /**
   * Start the service
   * From MAW Guide - Auto-register every 10s
   */
  async start(): Promise<void> {
    // Start auto-registration
    this.registry.startAutoRegister();
    console.log('[AgentService] Auto-registration started (every 10s)');

    // Load all agents from YAML
    const agentConfigs = await this.agentLoader.loadAllAgents();
    console.log(`[AgentService] Loaded ${agentConfigs.size} agent configurations`);

    // Register all agents with registry
    for (const [name, config] of agentConfigs.entries()) {
      // Create mock AgentBase for registration (in real implementation, would use actual agents)
      const mockAgent = new (class extends AgentBase {
        constructor() {
          super(config);
          (this as any)['agentId'] = name;
        }
        protected async initialize(): Promise<void> {}
        protected async execute(): Promise<void> {}
      })();
      
      this.registry.registerAgent(mockAgent);
    }

    // Start HTTP server
    this.server = this.app.listen(this.port, () => {
      console.log(`[AgentService] Running on http://localhost:${this.port}`);
      console.log(`[AgentService] GET /agents/status - View all agent statuses`);
    });
  }

  /**
   * Stop the service
   * From MAW Guide - Auto-register every 10s
   */
  async stop(): Promise<void> {
    // Stop auto-registration
    this.registry.stopAutoRegister();
    console.log('[AgentService] Auto-registration stopped');

    // Stop HTTP server
    if (this.server) {
      this.server.close(() => {
        console.log('[AgentService] HTTP server stopped');
      });
    }
  }

  /**
   * Get registry instance
   * From MAW Guide - Auto-register every 10s
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }
}
