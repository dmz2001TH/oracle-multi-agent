/**
 * Oracle Checkpointer Tests
 * RED-GREEN-REFACTOR: save state → crash → load state → must get original state
 * From LangGraph Checkpoint + MAW Guide
 */

import { OracleCheckpointer } from '../../core/checkpointer/oracle-checkpointer';

// Simple mock functions for testing without vitest
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
    resetCalls: () => { calls.length = 0; },
    setQueryResult: (result: any[]) => {
      return (sql: string, params: any[]) => {
        calls.push({ type: 'query', sql, params });
        return Promise.resolve(result) as Promise<any[]>;
      };
    }
  };
}

/**
 * Test: Save checkpoint to Oracle DB
 * From LangGraph Checkpoint + MAW Guide
 */
async function test_save_checkpoint() {
  console.log('Test: Save checkpoint to Oracle DB');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  
  const config = { configurable: { thread_id: 'test-thread-123' } };
  const checkpoint = {
    channel_values: {
      agent1: { status: 'active', task: 'test task' }
    },
    metadata: {
      timestamp: Date.now(),
      phase: 'execution' as const
    }
  };

  await checkpointer.put(config, checkpoint);

  const calls = mockDB.getCalls();
  console.log(`✓ Execute calls: ${calls.filter(c => c.type === 'execute').length}`);
  
  if (calls.some(c => c.sql.includes('INSERT INTO checkpoints'))) {
    console.log('✓ Checkpoint saved');
  }
  if (calls.some(c => c.sql.includes('INSERT INTO agent_states'))) {
    console.log('✓ Agent states saved');
  }
}

/**
 * Test: Get checkpoint from Oracle DB
 * From LangGraph Checkpoint + MAW Guide
 */
async function test_get_checkpoint() {
  console.log('\nTest: Get checkpoint from Oracle DB');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  
  const config = { configurable: { checkpoint_id: 'chk_test_123' } };
  const savedCheckpoint = {
    channel_values: {
      agent1: { status: 'active', task: 'test task' }
    },
    metadata: {
      timestamp: Date.now(),
      phase: 'execution' as const
    }
  };

  // Set query result for first call (checkpoint data)
  let callCount = 0;
  mockDB.query = (sql: string, params: any[]) => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve([
        {
          checkpoint_data: JSON.stringify(savedCheckpoint),
          metadata: JSON.stringify({})
        }
      ]) as Promise<any[]>;
    } else {
      return Promise.resolve([
        {
          agent_id: 'agent1',
          state_data: JSON.stringify({ status: 'active', task: 'test task' })
        }
      ]) as Promise<any[]>;
    }
  };

  const result = await checkpointer.get(config);

  if (result) {
    console.log('✓ Checkpoint retrieved');
    if (result.checkpoint.channel_values?.agent1?.status === 'active') {
      console.log('✓ Agent state restored correctly');
    }
  }
}

/**
 * Test: RED-GREEN-REFACTOR - Save state, crash, load state, must get original state
 * From LangGraph Checkpoint + MAW Guide
 */
async function test_crash_recovery() {
  console.log('\nTest: RED-GREEN-REFACTOR - Save state, crash, load state');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  
  const config = { configurable: { thread_id: 'test-thread-123' } };
  const originalState = {
    channel_values: {
      agent1: { 
        status: 'active', 
        task: 'implement feature X',
        progress: 50,
        memory: ['item1', 'item2']
      },
      agent2: {
        status: 'idle',
        task: null
      }
    },
    metadata: {
      checkpoint_id: 'chk_test_456',
      timestamp: Date.now(),
      phase: 'execution' as const
    }
  };

  // STEP 1: Save state
  await checkpointer.put(config, originalState);
  console.log('✓ State saved');

  // STEP 2: Simulate crash (reset mock)
  mockDB.resetCalls();

  // STEP 3: Mock query to return saved state with call counting
  let callCount = 0;
  mockDB.query = (sql: string, params: any[]) => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve([
        {
          checkpoint_data: JSON.stringify(originalState),
          metadata: JSON.stringify({})
        }
      ]) as Promise<any[]>;
    } else {
      return Promise.resolve([
        {
          agent_id: 'agent1',
          state_data: JSON.stringify(originalState.channel_values.agent1)
        },
        {
          agent_id: 'agent2',
          state_data: JSON.stringify(originalState.channel_values.agent2)
        }
      ]) as Promise<any[]>;
    }
  };

  // STEP 4: Load state after "crash"
  const restoredState = await checkpointer.get({
    configurable: { checkpoint_id: 'chk_test_456' }
  });

  // STEP 5: Verify restored state matches original
  if (restoredState?.checkpoint.channel_values) {
    const agent1 = restoredState.checkpoint.channel_values.agent1;
    if (
      agent1?.status === 'active' &&
      agent1?.task === 'implement feature X' &&
      agent1?.progress === 50 &&
      JSON.stringify(agent1?.memory) === JSON.stringify(['item1', 'item2'])
    ) {
      console.log('✓ RED-GREEN-REFACTOR: State restored correctly after crash');
    } else {
      console.log('✗ State mismatch after crash');
    }
  }
}

/**
 * Test: List checkpoints for thread
 * From LangGraph Checkpoint + MAW Guide
 */
async function test_list_checkpoints() {
  console.log('\nTest: List checkpoints for thread');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  
  const config = { configurable: { thread_id: 'test-thread-123' } };
  const checkpoints = [
    {
      checkpoint_id: 'chk_1',
      checkpoint_data: JSON.stringify({ channel_values: {} }),
      metadata: JSON.stringify({}),
      created_at: Date.now()
    },
    {
      checkpoint_id: 'chk_2',
      checkpoint_data: JSON.stringify({ channel_values: {} }),
      metadata: JSON.stringify({}),
      created_at: Date.now()
    }
  ];

  mockDB.query = mockDB.setQueryResult(checkpoints);

  const result = await checkpointer.list(config);

  if (result.length === 2) {
    console.log('✓ Listed 2 checkpoints');
  }
}

/**
 * Test: Save episodic memory
 * From MAW Guide 3-layer memory
 */
async function test_save_episodic_memory() {
  console.log('\nTest: Save episodic memory');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  
  const config = { configurable: { thread_id: 'test-thread-123' } };
  const checkpoint = {
    channel_values: {},
    metadata: {
      episodic_memory: [
        {
          agent_id: 'agent1',
          type: 'conversation',
          content: 'test conversation'
        }
      ]
    }
  };

  await checkpointer.put(config, checkpoint);

  const calls = mockDB.getCalls();
  if (calls.some(c => c.sql.includes('INSERT INTO memory_episodic'))) {
    console.log('✓ Episodic memory saved');
  }
}

/**
 * Test: Restore episodic memory
 * From MAW Guide 3-layer memory
 */
async function test_restore_episodic_memory() {
  console.log('\nTest: Restore episodic memory');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  
  const checkpointId = 'chk_test_789';
  const memories = [
    {
      agent_id: 'agent1',
      type: 'conversation',
      content: 'test conversation'
    }
  ];

  mockDB.query = mockDB.setQueryResult(
    memories.map(m => ({ content: JSON.stringify(m) }))
  );

  const result = await checkpointer.restoreEpisodicMemory(checkpointId);

  if (result.length === 1 && result[0].agent_id === 'agent1') {
    console.log('✓ Episodic memory restored');
  }
}

/**
 * Test: Return undefined for non-existent checkpoint
 * From LangGraph Checkpoint + MAW Guide
 */
async function test_nonexistent_checkpoint() {
  console.log('\nTest: Return undefined for non-existent checkpoint');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  
  const config = { configurable: { checkpoint_id: 'non-existent' } };
  mockDB.query = mockDB.setQueryResult([]);

  const result = await checkpointer.get(config);

  if (result === undefined) {
    console.log('✓ Returns undefined for non-existent checkpoint');
  }
}

/**
 * Test: Handle missing checkpoint_id in config
 * From LangGraph Checkpoint + MAW Guide
 */
async function test_missing_checkpoint_id() {
  console.log('\nTest: Handle missing checkpoint_id in config');
  
  const mockDB = createMockDB();
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread-123');
  
  const config = { configurable: {} };
  const result = await checkpointer.get(config);

  if (result === undefined) {
    console.log('✓ Returns undefined for missing checkpoint_id');
  }
}

// Run all tests
async function runAllTests() {
  console.log('=== Oracle Checkpointer Tests ===');
  console.log('From LangGraph Checkpoint + MAW Guide\n');
  
  try {
    await test_save_checkpoint();
    await test_get_checkpoint();
    await test_crash_recovery();
    await test_list_checkpoints();
    await test_save_episodic_memory();
    await test_restore_episodic_memory();
    await test_nonexistent_checkpoint();
    await test_missing_checkpoint_id();
    
    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Always run tests when executed
runAllTests();

export { runAllTests };
