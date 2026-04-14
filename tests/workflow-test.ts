/**
 * Workflow Test with WebSocket Log Stream
 * From Soul-Brews WebSocket Dashboard + MAW Guide
 */

import { Orchestrator } from '../core/orchestrator';
import { OracleCheckpointer } from '../core/checkpointer/oracle-checkpointer';

async function runWorkflowTest() {
  console.log('=== Workflow Test with Log Stream ===');
  console.log('From Soul-Brews WebSocket Dashboard + MAW Guide\n');
  
  // Create mock DB
  const mockDB = {
    execute: () => Promise.resolve(),
    query: () => Promise.resolve([])
  };
  
  // Create orchestrator with checkpointer
  const checkpointer = new OracleCheckpointer(mockDB as any, 'test-thread');
  const orchestrator = new Orchestrator(checkpointer);
  
  // Set WebSocket emitter to capture logs
  const logs: any[] = [];
  orchestrator.setWsEmitter((event: string, data: any) => {
    logs.push({ event, data, timestamp: Date.now() });
    console.log(`[WS EMIT] ${event}:`, data);
  });
  
  // Load agents
  await orchestrator.loadAgents();
  
  // Execute workflow
  const goal = 'Test goal for dashboard demonstration';
  console.log(`\nExecuting goal: ${goal}`);
  const result = await orchestrator.execute(goal);
  
  console.log('\n=== Captured Log Stream Events ===');
  logs.forEach(log => {
    console.log(`[${log.event}] ${JSON.stringify(log.data)}`);
  });
  
  console.log('\n=== Workflow Test Completed ===');
  console.log(`Total logs captured: ${logs.length}`);
  console.log(`Final progress: ${result.progress}%`);
}

runWorkflowTest().catch(console.error);
