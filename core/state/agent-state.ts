/**
 * Agent State Interface for StateGraph
 * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
 */

export interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
}

export interface Task {
  id: string;
  description: string;
  assignedTo: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  createdAt: number;
}

export interface ToolUsage {
  tool: string;
  timestamp: number;
  success: boolean;
}

/**
 * Agent State for StateGraph
 * From LangGraph StateGraph + Soul-Brews Hierarchical Pattern
 */
export interface AgentState {
  // Task Information
  currentGoal: string;
  currentTask: string | null;
  taskHistory: Task[];
  
  // Agent Information
  agentId: string;
  agentRole: string;
  agentStatus: 'idle' | 'active' | 'blocked' | 'error';
  
  // Communication
  messages: Message[];
  lastMessageFrom: string | null;
  
  // Progress
  progress: number; // 0-100
  startTime: number;
  estimatedCompletion: number;
  
  // Dependencies
  dependencies: string[];
  blockedBy: string | null;
  
  // Tools & Resources
  availableTools: string[];
  toolUsage: ToolUsage[];
  
  // Memory
  workingMemory: Record<string, any>;
  context: Record<string, any>;
  
  // Required fields for orchestration
  current_agent: string;
  task_queue: Task[];
  human_approval_needed: boolean;
}
