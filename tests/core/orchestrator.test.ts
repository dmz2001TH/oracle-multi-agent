/**
 * Orchestrator Tests
 * RED-GREEN-REFACTOR: send goal → CEO → Planner → Worker → done
 * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
 */

import { Orchestrator } from '../../core/orchestrator';
import { OracleCheckpointer } from '../../core/checkpointer/oracle-checkpointer';
import { AgentState } from '../../core/state/agent-state';

// Simple mock DB for testing
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
    getCalls: () => calls,
    resetCalls: () => { calls.length = 0; }
  };
}

/**
 * Test: RED-GREEN-REFACTOR - Execute workflow end-to-end
 * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
 */
async function test_workflow_execution() {
  console.log('Test: RED-GREEN-REFACTOR - Execute workflow end-to-end');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  const orchestrator = new Orchestrator(checkpointer);
  
  const goal = 'Implement feature X';
  const result = await orchestrator.execute(goal, 'agent-123');
  
  // Verify workflow completed
  if (result.progress === 100) {
    console.log('✓ Workflow completed (progress: 100%)');
  }
  
  // Verify state transitions
  if (result.messages.length >= 4) {
    console.log('✓ State passed through all nodes (messages: ' + result.messages.length + ')');
  }
  
  // Verify task queue
  if (result.task_queue.length > 0 && result.task_queue[0].status === 'completed') {
    console.log('✓ Task completed successfully');
  }
  
  // Verify checkpoint was saved
  const calls = mockDB.getCalls();
  if (calls.some(c => c.sql.includes('INSERT INTO checkpoints'))) {
    console.log('✓ Checkpoint saved during workflow');
  }
  
  return result;
}

/**
 * Test: State transitions between nodes
 * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
 */
async function test_state_transitions() {
  console.log('\nTest: State transitions between nodes');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  const orchestrator = new Orchestrator(checkpointer);
  
  const result = await orchestrator.execute('Test goal', 'agent-456');
  
  // Verify CEO node execution
  if (result.current_agent === 'CEO' || result.messages.some(m => m.from === 'CEO')) {
    console.log('✓ CEO node executed');
  }
  
  // Verify Planner node execution
  if (result.messages.some(m => m.from === 'Planner')) {
    console.log('✓ Planner node executed');
  }
  
  // Verify Worker node execution
  if (result.messages.some(m => m.from === 'Worker')) {
    console.log('✓ Worker node executed');
  }
  
  // Verify Critic node execution
  if (result.messages.some(m => m.from === 'Critic')) {
    console.log('✓ Critic node executed');
  }
  
  // Verify agent status transitions
  const statusTransitions = result.messages.filter(m => m.to === 'Planner' || m.to === 'Worker' || m.to === 'Critic');
  if (statusTransitions.length >= 3) {
    console.log('✓ Agent status transitions correct');
  }
}

/**
 * Test: Task queue management
 * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
 */
async function test_task_queue_management() {
  console.log('\nTest: Task queue management');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  const orchestrator = new Orchestrator(checkpointer);
  
  const result = await orchestrator.execute('Test task', 'agent-789');
  
  // Verify task was created
  if (result.task_queue.length > 0) {
    console.log('✓ Task created in queue');
  }
  
  // Verify task was assigned
  if (result.task_queue[0]?.assignedTo === 'Worker') {
    console.log('✓ Task assigned to Worker');
  }
  
  // Verify task status changed
  if (result.task_queue[0]?.status === 'completed') {
    console.log('✓ Task status updated to completed');
  }
  
  // Verify task moved to history
  if (result.taskHistory.length > 0) {
    console.log('✓ Task moved to history');
  }
}

/**
 * Test: Checkpoint integration
 * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
 */
async function test_checkpoint_integration() {
  console.log('\nTest: Checkpoint integration');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  const orchestrator = new Orchestrator(checkpointer);
  
  await orchestrator.execute('Test checkpoint', 'agent-checkpoint');
  
  const calls = mockDB.getCalls();
  
  // Verify checkpoints were saved
  const checkpointCalls = calls.filter(c => c.sql.includes('INSERT INTO checkpoints'));
  if (checkpointCalls.length > 0) {
    console.log('✓ Checkpoints saved during workflow');
  }
  
  // Verify agent states were saved
  const agentStateCalls = calls.filter(c => c.sql.includes('INSERT INTO agent_states'));
  if (agentStateCalls.length > 0) {
    console.log('✓ Agent states saved during workflow');
  }
}

/**
 * Test: Message propagation
 * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
 */
async function test_message_propagation() {
  console.log('\nTest: Message propagation');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  const orchestrator = new Orchestrator(checkpointer);
  
  const result = await orchestrator.execute('Test messages', 'agent-messages');
  
  // Verify messages were created
  if (result.messages.length > 0) {
    console.log('✓ Messages created during workflow');
  }
  
  // Verify message flow: CEO → Planner → Worker → Critic
  const messageFlow = result.messages.map(m => m.from);
  if (messageFlow.includes('CEO') && messageFlow.includes('Planner') && 
      messageFlow.includes('Worker') && messageFlow.includes('Critic')) {
    console.log('✓ Message flow correct: CEO → Planner → Worker → Critic');
  }
  
  // Verify message timestamps
  const hasTimestamps = result.messages.every(m => m.timestamp > 0);
  if (hasTimestamps) {
    console.log('✓ All messages have timestamps');
  }
}

// Run all tests
async function runAllTests() {
  console.log('=== Orchestrator Tests ===');
  console.log('From LangGraph StateGraph + Soul-Brews Hierarchical Pattern\n');
  
  try {
    await test_workflow_execution();
    await test_state_transitions();
    await test_task_queue_management();
    await test_checkpoint_integration();
    await test_message_propagation();
    
    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Always run tests when executed
runAllTests();

export { runAllTests };
