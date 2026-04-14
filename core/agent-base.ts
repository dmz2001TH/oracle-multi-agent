/**
 * Agent Base - Abstract class with MAW Lifecycle
 * From MAW Guide + oracle-maw-guide
 */

import { AgentConfig } from './agentspec/agent-loader';
import { OracleCheckpointer } from './checkpointer/oracle-checkpointer';
import { CircuitBreaker, CircuitBreakerConfig } from './circuit-breaker';

export enum LifecycleState {
  Init = 'init',
  Active = 'active',
  Sleep = 'sleep',
  Blocked = 'blocked',
  Crash = 'crash',
  Resume = 'resume',
  Shutdown = 'shutdown'
}

/**
 * Agent Base - Abstract class with MAW Lifecycle
 * From MAW Guide + oracle-maw-guide
 */
export abstract class AgentBase {
  protected agentId: string;
  protected config: AgentConfig;
  protected state: LifecycleState = LifecycleState.Init;
  protected checkpointer: OracleCheckpointer | null = null;
  protected circuitBreaker: CircuitBreaker;
  protected startTime: number = 0;

  constructor(agentConfig: AgentConfig, checkpointer?: OracleCheckpointer) {
    this.agentId = agentConfig.name;
    this.config = agentConfig;
    this.checkpointer = checkpointer || null;
    
    // Initialize circuit breaker from lifecycle config
    const cbConfig: CircuitBreakerConfig = {
      failureThreshold: 3,
      cooldownPeriod: 60000,
      successThreshold: 2,
      timeout: agentConfig.constraints.max_execution_time * 1000
    };
    this.circuitBreaker = new CircuitBreaker(cbConfig);
  }

  /**
   * Start agent - Transition from Init to Active
   * From MAW Guide + oracle-maw-guide
   */
  async start(): Promise<void> {
    console.log(`[${this.agentId}] Starting agent...`);
    this.state = LifecycleState.Init;
    this.startTime = Date.now();
    
    // Register with checkpointer
    if (this.checkpointer) {
      await this.saveCheckpoint();
    }
    
    // Transition to Active
    this.state = LifecycleState.Active;
    console.log(`[${this.agentId}] Agent started and active`);
  }

  /**
   * Sleep agent - Transition from Active to Sleep
   * From MAW Guide + oracle-maw-guide
   */
  async sleep(): Promise<void> {
    console.log(`[${this.agentId}] Going to sleep...`);
    this.state = LifecycleState.Sleep;
    
    // Save state before sleep
    if (this.checkpointer) {
      await this.saveCheckpoint();
    }
  }

  /**
   * Wake agent - Transition from Sleep to Active
   * From MAW Guide + oracle-maw-guide
   */
  async wake(): Promise<void> {
    console.log(`[${this.agentId}] Waking up...`);
    this.state = LifecycleState.Active;
  }

  /**
   * Crash agent - Simulate crash and save emergency checkpoint
   * From MAW Guide + oracle-maw-guide
   */
  async crash(): Promise<void> {
    console.log(`[${this.agentId}] Agent crashed!`);
    this.state = LifecycleState.Crash;
    
    // Save emergency checkpoint
    if (this.checkpointer) {
      await this.saveEmergencyCheckpoint();
    }
  }

  /**
   * Resume agent - Load checkpoint and transition to Active
   * From MAW Guide + oracle-maw-guide
   */
  async resume(): Promise<void> {
    console.log(`[${this.agentId}] Resuming from crash...`);
    this.state = LifecycleState.Resume;
    
    // Load checkpoint
    if (this.checkpointer) {
      await this.loadCheckpoint();
    }
    
    // Reset circuit breaker
    this.circuitBreaker.reset();
    
    // Transition to Active
    this.state = LifecycleState.Active;
    console.log(`[${this.agentId}] Agent resumed and active`);
  }

  /**
   * Execute task with Circuit Breaker protection
   * From MAW Guide + oracle-maw-guide
   */
  async executeTask<T>(task: () => Promise<T>): Promise<T> {
    if (this.state !== LifecycleState.Active) {
      throw new Error(`Agent not in active state: ${this.state}`);
    }

    return this.circuitBreaker.execute(async () => {
      // Save checkpoint before task
      if (this.checkpointer) {
        await this.saveCheckpoint();
      }

      // Execute task
      const result = await task();

      // Save checkpoint after task
      if (this.checkpointer) {
        await this.saveCheckpoint();
      }

      return result;
    });
  }

  /**
   * Shutdown agent
   * From MAW Guide + oracle-maw-guide
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.agentId}] Shutting down...`);
    this.state = LifecycleState.Shutdown;
    
    // Save final checkpoint
    if (this.checkpointer) {
      await this.saveCheckpoint();
    }
  }

  /**
   * Save checkpoint to Oracle DB
   * From MAW Guide + oracle-maw-guide
   */
  protected async saveCheckpoint(): Promise<void> {
    if (!this.checkpointer) return;
    
    await this.checkpointer.put(
      { configurable: { thread_id: this.agentId } },
      {
        channel_values: {
          agentId: this.agentId,
          state: this.state,
          config: this.config,
          startTime: this.startTime,
          uptime: Date.now() - this.startTime
        }
      },
      { timestamp: Date.now(), state: this.state }
    );
  }

  /**
   * Save emergency checkpoint
   * From MAW Guide + oracle-maw-guide
   */
  protected async saveEmergencyCheckpoint(): Promise<void> {
    if (!this.checkpointer) return;
    
    await this.checkpointer.put(
      { configurable: { thread_id: this.agentId } },
      {
        channel_values: {
          agentId: this.agentId,
          state: this.state,
          config: this.config,
          crashTime: Date.now(),
          emergency: true
        }
      },
      { timestamp: Date.now(), state: this.state, emergency: true }
    );
  }

  /**
   * Load checkpoint from Oracle DB
   * From MAW Guide + oracle-maw-guide
   */
  protected async loadCheckpoint(): Promise<void> {
    if (!this.checkpointer) return;
    
    const checkpoint = await this.checkpointer.get({
      configurable: { thread_id: this.agentId }
    });

    if (checkpoint && checkpoint.checkpoint.channel_values) {
      const state = checkpoint.checkpoint.channel_values;
      const timestamp = checkpoint.metadata?.timestamp || Date.now();
      console.log(`[${this.agentId}] Loaded checkpoint from ${new Date(timestamp).toISOString()}`);
    }
  }

  /**
   * Get current lifecycle state
   * From MAW Guide + oracle-maw-guide
   */
  getState(): LifecycleState {
    return this.state;
  }

  /**
   * Get circuit breaker state
   * From MAW Guide + oracle-maw-guide
   */
  getCircuitState(): string {
    return this.circuitBreaker.getState();
  }

  /**
   * Get agent configuration
   * From MAW Guide + oracle-maw-guide
   */
  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * Abstract method for agent-specific initialization
   * From MAW Guide + oracle-maw-guide
   */
  protected abstract initialize(): Promise<void>;

  /**
   * Abstract method for agent-specific task execution
   * From MAW Guide + oracle-maw-guide
   */
  protected abstract execute(): Promise<void>;
}
