# Agent YAML Schema - PyAgentSpec

## Overview
From PyAgentSpec framework-agnostic agent definition, we design the YAML schema for oracle-multi-agent agents.

## Schema Design

### Base Agent Schema
```yaml
# From PyAgentSpec specification
name: string                    # Agent unique name
role: string                    # Agent role (manager, coder, researcher, etc.)
version: string                 # Schema version
description: string             # Agent description

# LLM Configuration
llm:
  provider: string              # mimo, gemini, openai, etc.
  model: string                 # Model ID
  api_key_env: string          # Environment variable for API key
  temperature: number           # 0.0-1.0
  max_tokens: integer          # Max tokens per response

# System Prompt
system_prompt: string           # Base system prompt
personality: string             # Personality traits
expertise: string[]             # Domain expertise

# Tools & Capabilities
tools:
  - name: string
    description: string
    parameters:
      type: object
      properties: object
      required: string[]

# Memory Configuration
memory:
  enabled: boolean
  type: string                  # episodic, semantic, procedural
  max_entries: integer
  retention_days: integer

# Lifecycle Configuration
lifecycle:
  auto_spawn: boolean
  auto_restart: boolean
  max_restarts: integer
  idle_timeout: integer         # seconds

# Communication
communication:
  channels: string[]            # websocket, http, message-bus
  heartbeat_interval: integer   # seconds

# Constraints & Safety
constraints:
  max_turns: integer            # Max conversation turns
  max_execution_time: integer    # seconds
  allowed_operations: string[]
  forbidden_operations: string[]
```

---

## Example YAML Files

### CEO Agent (Manager)
```yaml
name: Mother
role: manager
version: "1.0"
description: CEO agent that manages overall strategy and task delegation

llm:
  provider: mimo
  model: mimo-v2-pro
  api_key_env: MIMO_API_KEY
  temperature: 0.7
  max_tokens: 4000

system_prompt: |
  You are the CEO (Manager) Agent in a hierarchical multi-agent system.
  
  Your responsibilities:
  - Receive user goals and analyze requirements
  - Delegate tasks to the Planner agent
  - Monitor overall progress and coordinate agents
  - Request human approval for critical decisions
  - Handle escalations and blocker resolution
  
  Communication style:
  - Clear and concise
  - Strategic thinking
  - Proactive problem-solving
  - Human-centric decision-making

personality: strategic, proactive, human-centric
expertise:
  - project management
  - task coordination
  - strategic planning
  - human-in-the-loop

tools:
  - name: spawn_agent
    description: Spawn a new agent for specialized tasks
    parameters:
      type: object
      properties:
        name: { type: string }
        role: { type: string }
        task: { type: string }
      required: [name, role]
  
  - name: request_approval
    description: Request human approval for critical decisions
    parameters:
      type: object
      properties:
        decision: { type: string }
        rationale: { type: string }
        options: { type: array }
      required: [decision, rationale]
  
  - name: query_graph
    description: Search knowledge graph for information
    parameters:
      type: object
      properties:
        query: { type: string }
        limit: { type: integer }
      required: [query]

memory:
  enabled: true
  type: episodic
  max_entries: 1000
  retention_days: 90

lifecycle:
  auto_spawn: true
  auto_restart: true
  max_restarts: 5
  idle_timeout: 300

communication:
  channels: [websocket, http]
  heartbeat_interval: 10

constraints:
  max_turns: 15
  max_execution_time: 600
  allowed_operations:
    - spawn_agent
    - request_approval
    - query_graph
    - tell_agent
  forbidden_operations:
    - direct_file_write
    - system_commands
```

---

### Planner Agent
```yaml
name: Architect
role: planner
version: "1.0"
description: Planner agent that breaks down tasks and creates execution plans

llm:
  provider: mimo
  model: mimo-v2-pro
  api_key_env: MIMO_API_KEY
  temperature: 0.5
  max_tokens: 4000

system_prompt: |
  You are the Planner Agent in a hierarchical multi-agent system.
  
  Your responsibilities:
  - Receive high-level tasks from CEO
  - Break down into executable subtasks (2-5 minutes each)
  - Assign appropriate worker agents based on skills
  - Create execution plan with dependencies
  - Validate plan completeness and feasibility
  
  Planning principles:
  - YAGNI (You Ain't Gonna Need It)
  - Tasks should be atomic and testable
  - Dependencies should be minimal
  - Estimated completion times should be realistic

personality: analytical, methodical, detail-oriented
expertise:
  - task decomposition
  - dependency management
  - resource allocation
  - estimation

tools:
  - name: create_plan
    description: Create execution plan with subtasks
    parameters:
      type: object
      properties:
        tasks: { type: array }
        dependencies: { type: object }
        assignments: { type: object }
      required: [tasks]
  
  - name: assign_task
    description: Assign subtask to worker agent
    parameters:
      type: object
      properties:
        task_id: { type: string }
        agent_id: { type: string }
        deadline: { type: integer }
      required: [task_id, agent_id]
  
  - name: query_agents
    description: Query available agents and their skills
    parameters:
      type: object
      properties:
        role: { type: string }
        status: { type: string }
      required: []

memory:
  enabled: true
  type: procedural
  max_entries: 500
  retention_days: 60

lifecycle:
  auto_spawn: false
  auto_restart: true
  max_restarts: 3
  idle_timeout: 600

communication:
  channels: [http]
  heartbeat_interval: 10

constraints:
  max_turns: 10
  max_execution_time: 300
  allowed_operations:
    - create_plan
    - assign_task
    - query_agents
  forbidden_operations:
    - execute_code
    - direct_file_operations
```

---

### Coder Agent
```yaml
name: Neo
role: coder
version: "1.0"
description: Coder agent that implements code, debugging, and testing

llm:
  provider: mimo
  model: mimo-v2-pro
  api_key_env: MIMO_API_KEY
  temperature: 0.3
  max_tokens: 4000

system_prompt: |
  You are a Coder Agent in a hierarchical multi-agent system.
  
  Your responsibilities:
  - Receive subtasks from Planner
  - Implement code following TDD principles
  - Write tests before implementation (RED-GREEN-REFACTOR)
  - Debug and fix issues
  - Ensure code quality and best practices
  
  Coding principles:
  - TDD: Write failing test first, then implement
  - YAGNI: Only build what's needed
  - Clean code: Readable, maintainable, DRY
  - Type safety: Use TypeScript types properly

personality: precise, quality-focused, detail-oriented
expertise:
  - TypeScript/JavaScript
  - Node.js
  - Testing (Jest, Mocha)
  - Debugging
  - Code review

tools:
  - name: read_file
    description: Read file contents
    parameters:
      type: object
      properties:
        path: { type: string }
      required: [path]
  
  - name: write_file
    description: Write file contents
    parameters:
      type: object
      properties:
        path: { type: string }
        content: { type: string }
      required: [path, content]
  
  - name: call_api
    description: Call external API
    parameters:
      type: object
      properties:
        url: { type: string }
        method: { type: string }
        body: { type: string }
      required: [url]
  
  - name: run_test
    description: Run test suite
    parameters:
      type: object
      properties:
        path: { type: string }
        test_pattern: { type: string }
      required: [path]
  
  - name: remember
    description: Save learning to memory
    parameters:
      type: object
      properties:
        content: { type: string }
        category: { type: string }
        tags: { type: string }
      required: [content]
  
  - name: fetch_url
    description: Fetch content from URL
    parameters:
      type: object
      properties:
        url: { type: string }
      required: [url]

memory:
  enabled: true
  type: procedural
  max_entries: 2000
  retention_days: 30

lifecycle:
  auto_spawn: false
  auto_restart: true
  max_restarts: 5
  idle_timeout: 180

communication:
  channels: [http]
  heartbeat_interval: 10

constraints:
  max_turns: 15
  max_execution_time: 300
  allowed_operations:
    - read_file
    - write_file
    - call_api
    - run_test
    - remember
    - fetch_url
  forbidden_operations:
    - system_commands
    - database_direct_access
```

---

## YAML Loading Implementation

### TypeScript Adapter for PyAgentSpec
```typescript
// From PyAgentSpec - framework-agnostic agent loading
import { loadAgentConfig } from './agent-loader';

interface AgentConfig {
  name: string;
  role: string;
  version: string;
  description: string;
  llm: LLMConfig;
  system_prompt: string;
  personality: string;
  expertise: string[];
  tools: Tool[];
  memory: MemoryConfig;
  lifecycle: LifecycleConfig;
  communication: CommunicationConfig;
  constraints: ConstraintConfig;
}

class AgentLoader {
  /**
   * Load agent from YAML file
   * From PyAgentSpec pattern
   */
  static async loadFromYAML(path: string): Promise<AgentConfig> {
    const yamlContent = await fs.readFile(path, 'utf-8');
    const config = yaml.parse(yamlContent);
    
    // Validate against schema
    this.validateConfig(config);
    
    return config;
  }
  
  /**
   * Load all agents from agents/ directory
   */
  static async loadAllAgents(dir: string): Promise<Map<string, AgentConfig>> {
    const agents = new Map<string, AgentConfig>();
    const files = await fs.readdir(dir);
    
    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        const config = await this.loadFromYAML(`${dir}/${file}`);
        agents.set(config.name, config);
      }
    }
    
    return agents;
  }
  
  /**
   * Validate config against schema
   */
  private static validateConfig(config: any): void {
    // Required fields
    const required = ['name', 'role', 'llm', 'system_prompt'];
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate LLM config
    if (!config.llm.provider || !config.llm.model) {
      throw new Error('Invalid LLM configuration');
    }
  }
}

// Usage
const agents = await AgentLoader.loadAllAgents('./agents');
const ceoConfig = agents.get('Mother');
```

---

## Migration Strategy

### Current Hardcoded Agents → YAML
1. Extract current agent configurations
2. Convert to YAML format
3. Validate against schema
4. Test loading and execution
5. Remove hardcoded configs

### Migration Steps
```typescript
// Migration script
async function migrateAgents() {
  const currentAgents = getCurrentAgents(); // From existing code
  
  for (const agent of currentAgents) {
    const yamlConfig = convertToYAML(agent);
    const path = `./agents/${agent.name}.yaml`;
    await fs.writeFile(path, yaml);
  }
  
  console.log('Migration complete. Verify YAML files.');
}
```

---

## Field Descriptions

### Core Fields
- **name**: Unique identifier for the agent
- **role**: Agent type (manager, coder, researcher, etc.)
- **version**: Schema version for compatibility
- **description**: Human-readable description

### LLM Configuration
- **provider**: LLM provider (mimo, gemini, openai)
- **model**: Model identifier
- **api_key_env**: Environment variable name for API key
- **temperature**: Creativity/randomness (0.0-1.0)
- **max_tokens**: Maximum tokens per response

### Tools
- **name**: Tool identifier
- **description**: Tool purpose
- **parameters**: JSON Schema for tool parameters

### Memory
- **enabled**: Enable/disable memory
- **type**: Memory type (episodic, semantic, procedural)
- **max_entries**: Maximum memory entries
- **retention_days**: How long to keep memories

### Lifecycle
- **auto_spawn**: Automatically spawn on startup
- **auto_restart**: Restart on crash
- **max_restarts**: Maximum restart attempts
- **idle_timeout**: Seconds before idle agent shuts down

### Communication
- **channels**: Communication methods (websocket, http)
- **heartbeat_interval**: Seconds between heartbeats

### Constraints
- **max_turns**: Maximum conversation turns
- **max_execution_time**: Maximum execution time in seconds
- **allowed_operations**: Permitted operations
- **forbidden_operations**: Prohibited operations
