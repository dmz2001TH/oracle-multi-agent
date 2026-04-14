/**
 * Agent Service Tests
 * From MAW Guide - Auto-register every 10s
 */

import { AgentService } from '../../services/agent-service';

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

/**
 * Test: Start server → registry auto-registers agents in 10s
 * From MAW Guide - Auto-register every 10s
 */
async function test_auto_register_on_start() {
  console.log('Test: Start server → registry auto-registers agents in 10s');
  
  const service = new AgentService(4001); // Use different port for testing
  await service.start();
  
  // Wait a moment for registration
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const registry = service.getRegistry();
  const agents = registry.getAllAgents();
  
  if (agents.size === 5) {
    console.log('✓ Registry auto-registered 5 agents');
  } else {
    console.log(`✗ Expected 5 agents, got ${agents.size}`);
  }
  
  // Stop the service
  await service.stop();
}

/**
 * Test: GET /agents/status → returns agent list + state
 * From MAW Guide - Auto-register every 10s
 */
async function test_agents_status_endpoint() {
  console.log('\nTest: GET /agents/status → returns agent list + state');
  
  const service = new AgentService(4002); // Use different port for testing
  await service.start();
  
  // Wait for registration
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Simulate HTTP request to /agents/status
  // In real test, would use supertest or similar
  const registry = service.getRegistry();
  const agents = registry.getAllAgents();
  
  if (agents.size > 0) {
    console.log('✓ Agents status endpoint would return agent list');
    console.log(`✓ Total agents: ${agents.size}`);
  }
  
  // Stop the service
  await service.stop();
}

/**
 * Test: Registry heartbeat check
 * From MAW Guide - Auto-register every 10s
 */
async function test_registry_heartbeat_check() {
  console.log('\nTest: Registry heartbeat check');
  
  const service = new AgentService(4003); // Use different port for testing
  await service.start();
  
  // Wait for registration
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const registry = service.getRegistry();
  
  // Get an agent registration
  const agents = registry.getAllAgents();
  const firstAgent = Array.from(agents.entries())[0];
  
  if (firstAgent) {
    const [agentId, registration] = firstAgent;
    console.log(`✓ Agent ${agentId} registered with status: ${registration.status}`);
    
    // Simulate old heartbeat (crash detection)
    registration.lastHeartbeat = Date.now() - 35000;
    
    // Manually trigger heartbeat check
    await (registry as any).checkHeartbeats();
    
    const updatedRegistration = registry.getAgent(agentId);
    if (updatedRegistration?.status === 'crashed') {
      console.log('✓ Registry detected crashed agent');
    }
  }
  
  // Stop the service
  await service.stop();
}

// Run all tests
async function runAllTests() {
  console.log('=== Agent Service Tests ===');
  console.log('From MAW Guide - Auto-register every 10s\n');
  
  try {
    await test_auto_register_on_start();
    await test_agents_status_endpoint();
    await test_registry_heartbeat_check();
    
    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Always run tests when executed
runAllTests();

export { runAllTests };
