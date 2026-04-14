/**
 * Agent Loader - Load agent configurations from YAML files
 * From PyAgentSpec + MAW Guide
 */

import * as yaml from 'yaml';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

export interface LLMConfig {
  provider: string;
  model: string;
  api_key_env: string;
  temperature: number;
  max_tokens: number;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface MemoryConfig {
  enabled: boolean;
  type: string;
  max_entries: number;
  retention_days: number;
}

export interface LifecycleConfig {
  auto_spawn: boolean;
  auto_restart: boolean;
  max_restarts: number;
  idle_timeout: number;
}

export interface CommunicationConfig {
  channels: string[];
  heartbeat_interval: number;
}

export interface ConstraintConfig {
  max_turns: number;
  max_execution_time: number;
  allowed_operations: string[];
  forbidden_operations: string[];
}

export interface AgentConfig {
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

/**
 * Agent Loader - Load agent configurations from YAML files
 * From PyAgentSpec + MAW Guide
 */
export class AgentLoader {
  private agentsDir: string;

  constructor(agentsDir: string = './agents') {
    this.agentsDir = agentsDir;
  }

  /**
   * Load agent from YAML file
   * From PyAgentSpec + MAW Guide
   */
  async loadAgent(yamlPath: string): Promise<AgentConfig> {
    const yamlContent = await fs.readFile(yamlPath, 'utf-8');
    const config = yaml.parse(yamlContent) as AgentConfig;
    
    // Validate against schema
    this.validateConfig(config);
    
    return config;
  }

  /**
   * Load all agents from agents/ directory
   * From PyAgentSpec + MAW Guide
   */
  async loadAllAgents(): Promise<Map<string, AgentConfig>> {
    const agents = new Map<string, AgentConfig>();
    
    if (!fsSync.existsSync(this.agentsDir)) {
      console.warn(`Agents directory ${this.agentsDir} does not exist`);
      return agents;
    }

    const files = await fs.readdir(this.agentsDir);
    
    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        const config = await this.loadAgent(path.join(this.agentsDir, file));
        agents.set(config.name, config);
      }
    }
    
    return agents;
  }

  /**
   * Validate config against schema
   * From PyAgentSpec + MAW Guide
   */
  private validateConfig(config: any): void {
    // Required fields
    const required = ['name', 'role', 'llm', 'system_prompt'];
    for (const field of required) {
      if (!config[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate LLM config
    if (!config.llm.provider || !config.llm.model) {
      throw new Error('Invalid LLM configuration: provider and model are required');
    }

    // Validate tools if present
    if (config.tools) {
      if (!Array.isArray(config.tools)) {
        throw new Error('tools must be an array');
      }
      for (const tool of config.tools) {
        if (!tool.name || !tool.description) {
          throw new Error('Tool must have name and description');
        }
      }
    }

    // Validate memory config if present
    if (config.memory) {
      if (!config.memory.type) {
        throw new Error('Memory config must have type');
      }
      const validTypes = ['episodic', 'semantic', 'procedural'];
      if (!validTypes.includes(config.memory.type)) {
        throw new Error(`Invalid memory type: ${config.memory.type}`);
      }
    }
  }

  /**
   * Get agent configuration by name
   * From PyAgentSpec + MAW Guide
   */
  async getAgent(name: string): Promise<AgentConfig | undefined> {
    const agents = await this.loadAllAgents();
    return agents.get(name);
  }
}
