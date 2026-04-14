/**
 * Agent Loader Tests
 * RED-GREEN-REFACTOR: load ceo.yaml → must get config.name = "Mother"
 * From PyAgentSpec + MAW Guide
 */

import { AgentLoader, AgentConfig } from '../../core/agentspec/agent-loader';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Test: RED-GREEN-REFACTOR - Load ceo.yaml and verify config.name
 * From PyAgentSpec + MAW Guide
 */
async function test_load_ceo_yaml() {
  console.log('Test: RED-GREEN-REFACTOR - Load ceo.yaml and verify config.name');
  
  const loader = new AgentLoader('./agents');
  const config = await loader.loadAgent('./agents/ceo.yaml');
  
  if (config.name === 'Mother') {
    console.log('✓ config.name = "Mother"');
  } else {
    console.log('✗ config.name != "Mother", got:', config.name);
  }
  
  if (config.role === 'manager') {
    console.log('✓ config.role = "manager"');
  }
  
  if (config.llm.provider === 'mimo') {
    console.log('✓ config.llm.provider = "mimo"');
  }
}

/**
 * Test: loadAllAgents() → must get 5 agents
 * From PyAgentSpec + MAW Guide
 */
async function test_load_all_agents() {
  console.log('\nTest: loadAllAgents() → must get 5 agents');
  
  const loader = new AgentLoader('./agents');
  const agents = await loader.loadAllAgents();
  
  if (agents.size === 5) {
    console.log('✓ Loaded 5 agents');
  } else {
    console.log('✗ Expected 5 agents, got:', agents.size);
  }
  
  if (agents.has('Mother')) {
    console.log('✓ Has Mother (CEO)');
  }
  
  if (agents.has('Architect')) {
    console.log('✓ Has Architect (Planner)');
  }
  
  if (agents.has('Neo')) {
    console.log('✓ Has Neo (Coder)');
  }
  
  if (agents.has('Sherlock')) {
    console.log('✓ Has Sherlock (Researcher)');
  }
  
  if (agents.has('Morpheus')) {
    console.log('✓ Has Morpheus (Critic)');
  }
}

/**
 * Test: validate schema → yaml missing field must throw error
 * From PyAgentSpec + MAW Guide
 */
async function test_validate_schema() {
  console.log('\nTest: validate schema → yaml missing field must throw error');
  
  const loader = new AgentLoader('./agents');
  
  // Create a temporary invalid YAML file
  const invalidYaml = `
name: InvalidAgent
role: test
# Missing llm field
system_prompt: "test"
`;
  
  const tempPath = './tests/temp-invalid.yaml';
  await fs.writeFile(tempPath, invalidYaml);
  
  try {
    await loader.loadAgent(tempPath);
    console.log('✗ Should have thrown error for missing llm field');
  } catch (error: any) {
    if (error.message.includes('llm')) {
      console.log('✓ Threw error for missing llm field:', error.message);
    } else {
      console.log('✗ Threw error but for wrong reason:', error.message);
    }
  } finally {
    // Clean up temp file
    try {
      await fs.unlink(tempPath);
    } catch (e) {
      // Ignore if file doesn't exist
    }
  }
}

/**
 * Test: getAgent by name
 * From PyAgentSpec + MAW Guide
 */
async function test_get_agent_by_name() {
  console.log('\nTest: getAgent by name');
  
  const loader = new AgentLoader('./agents');
  const ceo = await loader.getAgent('Mother');
  
  if (ceo && ceo.name === 'Mother') {
    console.log('✓ Retrieved CEO agent by name');
  } else {
    console.log('✗ Failed to retrieve CEO agent');
  }
  
  const nonExistent = await loader.getAgent('NonExistent');
  if (!nonExistent) {
    console.log('✓ Returns undefined for non-existent agent');
  }
}

/**
 * Test: validate tools array
 * From PyAgentSpec + MAW Guide
 */
async function test_validate_tools() {
  console.log('\nTest: validate tools array');
  
  const loader = new AgentLoader('./agents');
  const config = await loader.loadAgent('./agents/ceo.yaml');
  
  if (Array.isArray(config.tools)) {
    console.log('✓ tools is an array');
  }
  
  if (config.tools.length > 0) {
    console.log('✓ CEO has tools:', config.tools.length);
  }
  
  if (config.tools[0]?.name && config.tools[0]?.description) {
    console.log('✓ Tools have name and description');
  }
}

/**
 * Test: validate memory type
 * From PyAgentSpec + MAW Guide
 */
async function test_validate_memory_type() {
  console.log('\nTest: validate memory type');
  
  const loader = new AgentLoader('./agents');
  const config = await loader.loadAgent('./agents/ceo.yaml');
  
  const validTypes = ['episodic', 'semantic', 'procedural'];
  if (validTypes.includes(config.memory.type)) {
    console.log('✓ Memory type is valid:', config.memory.type);
  }
}

// Run all tests
async function runAllTests() {
  console.log('=== Agent Loader Tests ===');
  console.log('From PyAgentSpec + MAW Guide\n');
  
  try {
    await test_load_ceo_yaml();
    await test_load_all_agents();
    await test_validate_schema();
    await test_get_agent_by_name();
    await test_validate_tools();
    await test_validate_memory_type();
    
    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Always run tests when executed
runAllTests();

export { runAllTests };
