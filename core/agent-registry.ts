/**
 * Agent Registry - Auto-register and monitor agents
 * From MAW Guide - Auto-register every 10s
 */

import { AgentBase, LifecycleState } from './agent-base';
import { OracleCheckpointer } from './checkpointer/oracle-checkpointer';

export interface AgentRegistration {
  agent: AgentBase;
  registeredAt: number;
  lastHeartbeat: number;
  status: 'active' | 'inactive' | 'crashed';
}

/**
 * Agent Registry - Auto-register and monitor agents
 * From MAW Guide - Auto-register every 10s
 */
export class AgentRegistry {
  private agents: Map<string, AgentRegistration> = new Map();
  private checkpointer: OracleCheckpointer | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 10000; // 10 seconds
  private readonly CRASH_TIMEOUT = 30000; // 30 seconds

  constructor(checkpointer?: OracleCheckpointer) {
    this.checkpointer = checkpointer || null;
  }

  /**
   * Register agent with registry
   * From MAW Guide - Auto-register every 10s
   */
  registerAgent(agent: AgentBase): void {
    const registration: AgentRegistration = {
      agent,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active'
    };
    
    this.agents.set(agent['agentId'], registration);
    console.log(`[Registry] Registered agent: ${agent['agentId']}`);
    
    // Save to Oracle DB if checkpointer available
    if (this.checkpointer) {
      this.saveAgentState(agent['agentId'], 'registered');
    }
  }

  /**
   * Unregister agent from registry
   * From MAW Guide - Auto-register every 10s
   */
  unregisterAgent(agentId: string): void {
    const registration = this.agents.get(agentId);
    if (registration) {
      this.agents.delete(agentId);
      console.log(`[Registry] Unregistered agent: ${agentId}`);
      
      // Save to Oracle DB if checkpointer available
      if (this.checkpointer) {
        this.saveAgentState(agentId, 'unregistered');
      }
    }
  }

  /**
   * Start auto-registration and heartbeat monitoring
   * From MAW Guide - Auto-register every 10s
   */
  startAutoRegister(): void {
    console.log('[Registry] Starting auto-registration and heartbeat monitoring');
    
    // Start heartbeat interval
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Stop auto-registration and heartbeat monitoring
   * From MAW Guide - Auto-register every 10s
   */
  stopAutoRegister(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[Registry] Stopped auto-registration and heartbeat monitoring');
    }
  }

  /**
   * Check heartbeats and detect crashed agents
   * From MAW Guide - Auto-register every 10s
   */
  private checkHeartbeats(): void {
    const now = Date.now();
    
    for (const [agentId, registration] of this.agents.entries()) {
      const timeSinceHeartbeat = now - registration.lastHeartbeat;
      
      // Check if agent is crashed (no heartbeat for 30 seconds)
      if (timeSinceHeartbeat > this.CRASH_TIMEOUT) {
        console.warn(`[Registry] Agent ${agentId} crashed (no heartbeat for ${timeSinceHeartbeat}ms)`);
        registration.status = 'crashed';
        
        // Attempt to resume the agent
        this.resumeAgent(agentId, registration.agent);
      } else {
        // Update heartbeat timestamp
        registration.lastHeartbeat = now;
      }
    }
  }

  /**
   * Resume crashed agent
   * From MAW Guide - Auto-register every 10s
   */
  private async resumeAgent(agentId: string, agent: AgentBase): Promise<void> {
    try {
      console.log(`[Registry] Attempting to resume agent: ${agentId}`);
      await agent.resume();
      const registration = this.agents.get(agentId);
      if (registration) {
        registration.status = 'active';
        registration.lastHeartbeat = Date.now();
      }
      console.log(`[Registry] Agent ${agentId} resumed successfully`);
    } catch (error: any) {
      console.error(`[Registry] Failed to resume agent ${agentId}:`, error.message);
    }
  }

  /**
   * Get agent registration
   * From MAW Guide - Auto-register every 10s
   */
  getAgent(agentId: string): AgentRegistration | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents
   * From MAW Guide - Auto-register every 10s
   */
  getAllAgents(): Map<string, AgentRegistration> {
    return this.agents;
  }

  /**
   * Get agent status
   * From MAW Guide - Auto-register every 10s
   */
  getAgentStatus(agentId: string): string {
    const registration = this.agents.get(agentId);
    return registration?.status || 'unknown';
  }

  /**
   * Save agent state to Oracle DB
   * From MAW Guide - Auto-register every 10s
   */
  private async saveAgentState(agentId: string, status: string): Promise<void> {
    if (!this.checkpointer) return;
    
    try {
      await this.checkpointer.put(
        { configurable: { thread_id: agentId } },
        {
          channel_values: {
            agentId,
            status,
            timestamp: Date.now()
          }
        },
        { timestamp: Date.now(), type: 'registry' }
      );
    } catch (error: any) {
      console.error(`[Registry] Failed to save agent state: ${error.message}`);
    }
  }
}
