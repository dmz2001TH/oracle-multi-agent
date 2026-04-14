/**
 * Orchestrator - StateGraph-based Multi-Agent Orchestration
 * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
 */

import { AgentState, Task, Message } from './state/agent-state';
import { OracleCheckpointer } from './checkpointer/oracle-checkpointer';
import { AgentLoader, AgentConfig } from './agentspec/agent-loader';
import { AgentRegistry } from './agent-registry';
import { CircuitBreaker } from './circuit-breaker';
import { AgentBase, LifecycleState } from './agent-base';
import { searchMemory } from '../api/hono-client';

// Mock StateGraph for now (LangGraph needs to be installed)
// TODO: Install @langchain/langgraph and replace this mock
class StateGraph<T extends Record<string, any>> {
  private nodes: Map<string, (state: T) => Promise<T>> = new Map();
  private edges: Map<string, string> = new Map();
  private conditionalEdges: Map<string, (state: T) => string> = new Map();

  addNode(name: string, fn: (state: T) => Promise<T>): this {
    this.nodes.set(name, fn);
    return this;
  }

  addEdge(from: string, to: string): this {
    this.edges.set(from, to);
    return this;
  }

  addConditionalEdges(
    from: string,
    condition: (state: T) => string,
    mapping: Record<string, string>
  ): this {
    this.conditionalEdges.set(from, condition);
    return this;
  }

  compile(config?: { checkpointer?: OracleCheckpointer }): any {
    return {
      invoke: async (initialState: T) => {
        let state = initialState;
        let currentNode = 'CEO';

        while (currentNode) {
          const nodeFn = this.nodes.get(currentNode);
          if (nodeFn) {
            state = await nodeFn(state);
            
            // Save checkpoint if available
            if (config?.checkpointer && state.agentId) {
              await config.checkpointer.put(
                { configurable: { thread_id: state.agentId } },
                { channel_values: state },
                { timestamp: Date.now() }
              );
            }
          }

          // Simple edge following (this is a mock, real LangGraph has more complex logic)
          if (currentNode === 'CEO') {
            currentNode = 'Planner';
          } else if (currentNode === 'Planner') {
            currentNode = 'Worker';
          } else if (currentNode === 'Worker') {
            currentNode = 'Critic';
          } else if (currentNode === 'Critic') {
            currentNode = ''; // End of workflow
          }
        }

        return state;
      }
    };
  }
}

/**
 * CEO Node - Overall strategy and task delegation
 * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
 */
async function ceoNode(state: AgentState, wsEmitter?: ((event: string, data: any) => void)): Promise<AgentState> {
  console.log(`[CEO] Processing goal: ${state.currentGoal}`);
  
  // Emit log stream to dashboard
  if (wsEmitter) {
    wsEmitter('log_stream', { agentId: 'CEO', level: 'info', message: `Processing goal: ${state.currentGoal}` });
  }
  
  // MAW Integration: Would use AgentBase here
  // const agent = new AgentBase(config, checkpointer);
  // await agent.start();
  // await agent.executeTask(async () => { ... });
  // await circuitBreaker.execute(async () => { ... });
  
  // Analyze complexity and delegate to Planner
  state.agentStatus = 'active';
  state.current_agent = 'Planner';
  state.task_queue = [
    {
      id: 'task-1',
      description: `Execute: ${state.currentGoal}`,
      assignedTo: 'Worker',
      status: 'pending',
      dependencies: [],
      createdAt: Date.now()
    }
  ];
  state.messages.push({
    id: `msg-${Date.now()}`,
    from: 'CEO',
    to: 'Planner',
    content: `Task assigned: ${state.currentGoal}`,
    timestamp: Date.now()
  });
  
  return state;
}

/**
 * Planner Node - Task decomposition and planning
 * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
 */
async function plannerNode(state: AgentState, wsEmitter?: ((event: string, data: any) => void)): Promise<AgentState> {
  console.log(`[Planner] Breaking down task for CEO`);
  
  // Emit log stream to dashboard
  if (wsEmitter) {
    wsEmitter('log_stream', { agentId: 'Planner', level: 'info', message: 'Breaking down task for CEO' });
  }
  
  // Tool: hono_memory_search - Search Hono System memory before task delegation
  try {
    const memoryResults = await searchMemory(state.currentGoal);
    console.log(`[Planner] Hono memory search results:`, memoryResults);
    state.workingMemory = { ...state.workingMemory, honoMemory: memoryResults };
    
    if (wsEmitter) {
      wsEmitter('log_stream', { agentId: 'Planner', level: 'info', message: `Memory search completed: ${memoryResults.total || 0} results` });
    }
  } catch (error) {
    console.error(`[Planner] Hono memory search failed:`, error);
  }
  
  // Break down task and assign to Worker
  state.agentStatus = 'active';
  state.current_agent = 'Worker';
  state.currentTask = state.task_queue[0]?.description || null;
  state.progress = 25;
  
  state.messages.push({
    id: `msg-${Date.now()}`,
    from: 'Planner',
    to: 'Worker',
    content: `Subtask assigned: ${state.currentTask}`,
    timestamp: Date.now()
  });
  
  return state;
}

/**
 * Worker Node - Execute specific subtasks
 * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
 */
async function workerNode(state: AgentState, wsEmitter?: ((event: string, data: any) => void)): Promise<AgentState> {
  console.log(`[Worker] Executing: ${state.currentTask}`);
  
  // Emit log stream to dashboard
  if (wsEmitter) {
    wsEmitter('log_stream', { agentId: 'Worker', level: 'info', message: `Executing: ${state.currentTask}` });
  }
  
  // Execute task
  state.agentStatus = 'active';
  state.progress = 75;
  state.task_queue[0].status = 'completed';
  
  state.messages.push({
    id: `msg-${Date.now()}`,
    from: 'Worker',
    to: 'Critic',
    content: `Task completed: ${state.currentTask}`,
    timestamp: Date.now()
  });
  
  return state;
}

/**
 * Critic Node - Quality assurance and review
 * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
 */
async function criticNode(state: AgentState, wsEmitter?: ((event: string, data: any) => void)): Promise<AgentState> {
  console.log(`[Critic] Reviewing task from Worker`);
  
  // Emit log stream to dashboard
  if (wsEmitter) {
    wsEmitter('log_stream', { agentId: 'Critic', level: 'info', message: 'Reviewing task from Worker' });
  }
  
  // Review task (approve for now)
  state.agentStatus = 'idle';
  state.progress = 100;
  state.current_agent = 'CEO';
  state.taskHistory = [...state.task_queue];
  
  state.messages.push({
    id: `msg-${Date.now()}`,
    from: 'Critic',
    to: 'CEO',
    content: 'Task approved',
    timestamp: Date.now()
  });
  
  return state;
}

/**
 * Human-Approve Node - Human-in-the-loop for critical decisions
 * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
 */
async function humanApproveNode(state: AgentState, wsEmitter?: ((event: string, data: any) => void)): Promise<AgentState> {
  console.log(`[Human-Approve] Waiting for human approval`);
  
  // Emit approval request to dashboard
  if (wsEmitter) {
    wsEmitter('approve_request', {
      requestId: `req-${Date.now()}`,
      decision: 'Critical decision required',
      rationale: 'Human approval needed for task continuation'
    });
    wsEmitter('log_stream', { agentId: 'HumanApprove', level: 'warn', message: 'Waiting for human approval' });
  }
  
  state.human_approval_needed = true;
  state.agentStatus = 'blocked';
  
  // In real implementation, this would wait for WebSocket approval
  // For now, auto-approve
  state.human_approval_needed = false;
  state.agentStatus = 'active';
  
  return state;
}

/**
 * Orchestrator Class - Manages StateGraph workflow
 * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
 */
export class Orchestrator {
  private workflow: any;
  private checkpointer: OracleCheckpointer | null = null;
  private agentLoader: AgentLoader;
  private agentConfigs: Map<string, AgentConfig> = new Map();
  private agentRegistry: AgentRegistry;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private wsEmitter: ((event: string, data: any) => void) | null = null;

  constructor(checkpointer?: OracleCheckpointer) {
    this.checkpointer = checkpointer || null;
    this.agentLoader = new AgentLoader('./agents');
    this.agentRegistry = new AgentRegistry(checkpointer || undefined);
    this.workflow = this.createWorkflow();
  }

  /**
   * Set WebSocket emitter for dashboard integration
   * From Soul-Brews WebSocket Dashboard + MAW Guide
   */
  setWsEmitter(emitter: (event: string, data: any) => void): void {
    this.wsEmitter = emitter;
  }

  /**
   * Emit event to WebSocket dashboard
   * From Soul-Brews WebSocket Dashboard + MAW Guide
   */
  private emit(event: string, data: any): void {
    if (this.wsEmitter) {
      this.wsEmitter(event, data);
    }
  }

  /**
   * Load agent configurations from YAML files
   * From PyAgentSpec + MAW Guide
   */
  async loadAgents(): Promise<void> {
    this.agentConfigs = await this.agentLoader.loadAllAgents();
    console.log(`Loaded ${this.agentConfigs.size} agent configurations`);
    
    // Initialize circuit breakers for each agent
    for (const [name, config] of this.agentConfigs.entries()) {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        cooldownPeriod: 60000,
        successThreshold: 2,
        timeout: config.constraints.max_execution_time * 1000
      });
      this.circuitBreakers.set(name, breaker);
    }
  }

  /**
   * Register all agents with registry
   * From MAW Guide - Auto-register every 10s
   */
  async registerAllAgents(): Promise<void> {
    // Start auto-registration
    this.agentRegistry.startAutoRegister();
    
    // Register all loaded agents
    for (const [name, config] of this.agentConfigs.entries()) {
      // Note: In real implementation, would create AgentBase instances here
      // For now, we just log the registration
      console.log(`[Orchestrator] Agent ${name} ready for registration`);
    }
  }

  /**
   * Create StateGraph workflow
   * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
   */
  private createWorkflow(): any {
    const workflow = new StateGraph<AgentState>();
    const emitter = this.wsEmitter || undefined;

    // Add nodes with wsEmitter
    workflow.addNode('CEO', (state) => ceoNode(state, emitter));
    workflow.addNode('Planner', (state) => plannerNode(state, emitter));
    workflow.addNode('Worker', (state) => workerNode(state, emitter));
    workflow.addNode('Critic', (state) => criticNode(state, emitter));
    workflow.addNode('HumanApprove', (state) => humanApproveNode(state, emitter));

    // Add edges (following Mermaid diagram)
    workflow.addEdge('CEO', 'Planner');
    workflow.addEdge('Planner', 'Worker');
    workflow.addEdge('Worker', 'Critic');
    workflow.addEdge('Critic', 'CEO');
    workflow.addEdge('CEO', 'HumanApprove');
    workflow.addEdge('HumanApprove', 'CEO');

    // Compile with checkpointer
    return workflow.compile({
      checkpointer: this.checkpointer || undefined
    });
  }

  /**
   * Execute workflow with initial goal
   * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
   */
  async execute(goal: string, agentId: string = 'default'): Promise<AgentState> {
    // Register all agents with registry before starting workflow
    await this.registerAllAgents();
    
    // Emit agent_status at workflow start
    this.emit('agent_status', { status: 'starting', goal });
    
    const initialState: AgentState = {
      currentGoal: goal,
      currentTask: null,
      taskHistory: [],
      agentId,
      agentRole: 'CEO',
      agentStatus: 'idle',
      messages: [],
      lastMessageFrom: null,
      progress: 0,
      startTime: Date.now(),
      estimatedCompletion: 0,
      dependencies: [],
      blockedBy: null,
      availableTools: [],
      toolUsage: [],
      workingMemory: {},
      context: {},
      current_agent: 'CEO',
      task_queue: [],
      human_approval_needed: false
    };

    const result = await this.workflow.invoke(initialState);
    
    // Emit agent_status at workflow end
    this.emit('agent_status', { status: 'completed', progress: result.progress });
    
    return result;
  }

  /**
   * Get workflow state
   * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
   */
  getState(): any {
    return this.workflow;
  }
}
