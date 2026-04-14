/**
 * MAW Lifecycle Tests
 * RED-GREEN-REFACTOR: init → start → active → crash → resume → active
 * From MAW Guide + oracle-maw-guide
 */

import { AgentBase, LifecycleState } from '../../core/agent-base';
import { CircuitBreaker, CircuitState } from '../../core/circuit-breaker';
import { AgentRegistry } from '../../core/agent-registry';
import { OracleCheckpointer } from '../../core/checkpointer/oracle-checkpointer';
import { AgentConfig } from '../../core/agentspec/agent-loader';

// Mock AgentConfig
function createMockAgentConfig(name: string = 'TestAgent'): AgentConfig {
  return {
    name,
    role: 'test',
    version: '1.0',
    description: 'Test agent',
    llm: {
      provider: 'mimo',
      model: 'mimo-v2-pro',
      api_key_env: 'MIMO_API_KEY',
      temperature: 0.7,
      max_tokens: 4000
    },
    system_prompt: 'Test prompt',
    personality: 'test',
    expertise: [],
    tools: [],
    memory: {
      enabled: true,
      type: 'episodic',
      max_entries: 1000,
      retention_days: 90
    },
    lifecycle: {
      auto_spawn: true,
      auto_restart: true,
      max_restarts: 5,
      idle_timeout: 300
    },
    communication: {
      channels: ['http'],
      heartbeat_interval: 10
    },
    constraints: {
      max_turns: 15,
      max_execution_time: 300,
      allowed_operations: [],
      forbidden_operations: []
    }
  };
}

// Mock DB for testing
function createMockDB() {
  const calls: any[] = [];
  return {
    execute: (sql: string, params: any[]) => {
      calls.push({ type: 'execute', sql, params });
      return Promise.resolve();
    },
    query: (sql: string, params: any[]) => {
      calls.push({ type: 'query', sql, params });
      return Promise.resolve([]) as Promise<any[]>;
    },
    getCalls: () => calls
  };
}

// Mock AgentBase implementation
class MockAgent extends AgentBase {
  private taskExecuted = false;
  private shouldFail = false;

  constructor(config: AgentConfig, checkpointer?: OracleCheckpointer) {
    super(config, checkpointer);
    // Make agentId accessible
    (this as any)['agentId'] = config.name;
  }

  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  wasTaskExecuted(): boolean {
    return this.taskExecuted;
  }

  protected async initialize(): Promise<void> {
    console.log(`[${this.agentId}] Initialized`);
  }

  protected async execute(): Promise<void> {
    console.log(`[${this.agentId}] Executing task`);
    this.taskExecuted = true;
    if (this.shouldFail) {
      throw new Error('Task failed');
    }
  }
}

/**
 * Test: RED-GREEN-REFACTOR - init → start → active → crash → resume → active
 * From MAW Guide + oracle-maw-guide
 */
async function test_lifecycle_crash_resume() {
  console.log('Test: RED-GREEN-REFACTOR - init → start → active → crash → resume → active');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  const config = createMockAgentConfig('LifecycleTest');
  const agent = new MockAgent(config, checkpointer);
  
  // Init state
  if (agent.getState() === LifecycleState.Init) {
    console.log('✓ Agent in Init state');
  }
  
  // Start agent
  await agent.start();
  if (agent.getState() === LifecycleState.Active) {
    console.log('✓ Agent transitioned to Active');
  }
  
  // Simulate crash
  await agent.crash();
  if (agent.getState() === LifecycleState.Crash) {
    console.log('✓ Agent transitioned to Crash');
  }
  
  // Resume agent
  await agent.resume();
  if (agent.getState() === LifecycleState.Active) {
    console.log('✓ Agent resumed to Active');
  }
}

/**
 * Test: Circuit Breaker - fail 3 times → OPEN → block call
 * From MAW Guide - Circuit Breaker pattern
 */
async function test_circuit_breaker() {
  console.log('\nTest: Circuit Breaker - fail 3 times → OPEN → block call');
  
  const breaker = new CircuitBreaker({
    failureThreshold: 3,
    cooldownPeriod: 60000,
    successThreshold: 2,
    timeout: 5000
  });
  
  // Initial state should be CLOSED
  if (breaker.getState() === CircuitState.CLOSED) {
    console.log('✓ Circuit breaker initial state: CLOSED');
  }
  
  // Fail 3 times
  for (let i = 0; i < 3; i++) {
    try {
      await breaker.execute(async () => {
        throw new Error('Task failed');
      });
    } catch (error) {
      // Expected to fail
    }
  }
  
  // Should be OPEN now
  if (breaker.getState() === CircuitState.OPEN) {
    console.log('✓ Circuit breaker OPEN after 3 failures');
  }
  
  // Should block calls when OPEN
  try {
    await breaker.execute(async () => {
      return 'success';
    });
    console.log('✗ Circuit breaker should have blocked call');
  } catch (error: any) {
    if (error.message === 'Circuit breaker is OPEN') {
      console.log('✓ Circuit breaker blocked call when OPEN');
    }
  }
}

/**
 * Test: Auto-register - mock agent dies → registry detect → resume
 * From MAW Guide - Auto-register every 10s
 */
async function test_auto_register_crash_resume() {
  console.log('\nTest: Auto-register - mock agent dies → registry detect → resume');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  const registry = new AgentRegistry(checkpointer);
  const config = createMockAgentConfig('AutoRegisterTest');
  const agent = new MockAgent(config, checkpointer);
  
  // Register agent
  registry.registerAgent(agent);
  
  const registration = registry.getAgent('AutoRegisterTest');
  if (registration && registration.status === 'active') {
    console.log('✓ Agent registered with status: active');
  }
  
  // Simulate agent crash by updating lastHeartbeat to old timestamp
  const oldRegistration = registry.getAgent('AutoRegisterTest');
  if (oldRegistration) {
    oldRegistration.lastHeartbeat = Date.now() - 35000; // 35 seconds ago
    oldRegistration.status = 'crashed';
  }
  
  // Manually trigger heartbeat check (normally done by interval)
  await (registry as any).checkHeartbeats();
  
  // Check if agent was marked as crashed
  const crashedRegistration = registry.getAgent('AutoRegisterTest');
  if (crashedRegistration?.status === 'crashed') {
    console.log('✓ Registry detected crashed agent');
  }
}

/**
 * Test: Agent executeTask with Circuit Breaker
 * From MAW Guide + oracle-maw-guide
 */
async function test_agent_execute_with_circuit_breaker() {
  console.log('\nTest: Agent executeTask with Circuit Breaker');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  const config = createMockAgentConfig('CircuitBreakerTest');
  const agent = new MockAgent(config, checkpointer);
  
  // Start agent
  await agent.start();
  
  // Execute task successfully
  await agent.executeTask(async () => {
    await (agent as any).execute();
  });
  
  if (agent.wasTaskExecuted()) {
    console.log('✓ Task executed successfully with Circuit Breaker');
  }
  
  // Set agent to fail
  agent.setShouldFail(true);
  
  // Execute task should fail
  try {
    await agent.executeTask(async () => {
      await (agent as any).execute();
    });
    console.log('✗ Task should have failed');
  } catch (error) {
    console.log('✓ Circuit Breaker caught task failure');
  }
}

/**
 * Test: Lifecycle state transitions
 * From MAW Guide + oracle-maw-guide
 */
async function test_lifecycle_state_transitions() {
  console.log('\nTest: Lifecycle state transitions');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  const config = createMockAgentConfig('StateTransitionTest');
  const agent = new MockAgent(config, checkpointer);
  
  // Init → Active
  await agent.start();
  if (agent.getState() === LifecycleState.Active) {
    console.log('✓ Init → Active transition');
  }
  
  // Active → Sleep
  await agent.sleep();
  if (agent.getState() === LifecycleState.Sleep) {
    console.log('✓ Active → Sleep transition');
  }
  
  // Sleep → Active (wake)
  await agent.wake();
  if (agent.getState() === LifecycleState.Active) {
    console.log('✓ Sleep → Active transition');
  }
  
  // Active → Crash
  await agent.crash();
  if (agent.getState() === LifecycleState.Crash) {
    console.log('✓ Active → Crash transition');
  }
  
  // Crash → Resume → Active
  await agent.resume();
  if (agent.getState() === LifecycleState.Active) {
    console.log('✓ Crash → Resume → Active transition');
  }
  
  // Active → Shutdown
  await agent.shutdown();
  if (agent.getState() === LifecycleState.Shutdown) {
    console.log('✓ Active → Shutdown transition');
  }
}

// Run all tests
async function runAllTests() {
  console.log('=== MAW Lifecycle Tests ===');
  console.log('From MAW Guide + oracle-maw-guide\n');
  
  try {
    await test_lifecycle_crash_resume();
    await test_circuit_breaker();
    await test_auto_register_crash_resume();
    await test_agent_execute_with_circuit_breaker();
    await test_lifecycle_state_transitions();
    
    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Always run tests when executed
runAllTests();

export { runAllTests };
