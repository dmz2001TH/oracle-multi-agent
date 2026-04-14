/**
 * Research Swarm — Parallel Agent Investigation Pattern
 * Spawn N agents to research a topic simultaneously, collect findings.
 * Based on: Multi-Agent Orchestration Book Chapter 5 — The Research Swarm
 */
import { EventEmitter } from "events";

export interface SwarmTask {
  id: string;
  topic: string;
  prompts: string[];        // one prompt per agent
  agentRoles: string[];     // role per agent
  createdAt: string;
  status: "pending" | "running" | "completed" | "failed";
  results: SwarmResult[];
  summary?: string;
}

export interface SwarmResult {
  agentName: string;
  agentRole: string;
  prompt: string;
  output: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
}

export interface SwarmConfig {
  maxAgents: number;       // max parallel agents
  timeoutMs: number;       // per-agent timeout
  retryOnFail: boolean;
  mergeStrategy: "concat" | "vote" | "synthesize";
}

const DEFAULT_CONFIG: SwarmConfig = {
  maxAgents: 5,
  timeoutMs: 60000,
  retryOnFail: false,
  mergeStrategy: "concat",
};

/**
 * Create a research swarm task.
 * Divides a topic into N sub-prompts and manages parallel execution.
 */
export function createSwarmTask(
  topic: string,
  prompts: string[],
  roles?: string[]
): SwarmTask {
  return {
    id: `swarm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    topic,
    prompts,
    agentRoles: roles || prompts.map((_, i) => `researcher-${i + 1}`),
    createdAt: new Date().toISOString(),
    status: "pending",
    results: [],
  };
}

/**
 * Fan-out research: split a topic into sub-questions for parallel research.
 */
export function fanOutResearch(topic: string, angles: string[]): SwarmTask {
  const prompts = angles.map(angle => `Research "${topic}" from the perspective of: ${angle}. Provide findings with evidence.`);
  return createSwarmTask(topic, prompts, angles);
}

/**
 * Create a review trio (coder + qa + reviewer).
 */
export function createReviewTrio(code: string, description: string): SwarmTask {
  return createSwarmTask(
    `Review: ${description}`,
    [
      `As a CODER: Review this code for correctness, performance, and best practices. Suggest improvements.\n\n${code}`,
      `As a QA TESTER: Identify edge cases, potential bugs, and test scenarios for this code.\n\n${code}`,
      `As a CRITIC: Evaluate the design decisions, architecture, and overall approach. What would you do differently?\n\n${code}`,
    ],
    ["coder", "qa-tester", "critic"]
  );
}

/**
 * Merge swarm results into a single summary.
 */
export function mergeResults(task: SwarmTask, strategy: SwarmConfig["mergeStrategy"] = "concat"): string {
  const completed = task.results.filter(r => !r.error);
  if (completed.length === 0) return "No results collected.";

  switch (strategy) {
    case "concat":
      return completed.map(r =>
        `## ${r.agentRole} (${r.agentName})\n${r.output}`
      ).join("\n\n---\n\n");

    case "vote":
      // Return all results with counts
      return `## Research Results: ${task.topic}\n\n` +
        completed.map(r => `- **${r.agentRole}**: ${r.output.substring(0, 300)}`).join("\n");

    case "synthesize":
      // Simple concatenation with synthesis header
      return `## Synthesis: ${task.topic}\n\n` +
        `Based on ${completed.length} parallel investigations:\n\n` +
        completed.map((r, i) => `### Finding ${i + 1} (${r.agentRole})\n${r.output}`).join("\n\n");

    default:
      return completed.map(r => r.output).join("\n\n");
  }
}

/**
 * Swarm executor — runs prompts in parallel with timeout.
 * This is the actual execution engine.
 */
export class SwarmExecutor extends EventEmitter {
  private config: SwarmConfig;

  constructor(config: Partial<SwarmConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a swarm task. Takes a callback that runs one prompt and returns a result.
   */
  async execute(
    task: SwarmTask,
    runner: (prompt: string, role: string, index: number) => Promise<string>
  ): Promise<SwarmTask> {
    task.status = "running";
    this.emit("start", task);

    const promises = task.prompts.map(async (prompt, i) => {
      const role = task.agentRoles[i] || `agent-${i}`;
      const agentName = `${task.id}-${role}`;
      const result: SwarmResult = {
        agentName, agentRole: role, prompt,
        output: "", startedAt: new Date().toISOString(),
      };

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), this.config.timeoutMs)
        );
        const output = await Promise.race([runner(prompt, role, i), timeoutPromise]);
        result.output = output;
        result.completedAt = new Date().toISOString();
        result.durationMs = new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime();
      } catch (err: any) {
        result.error = err.message;
        result.completedAt = new Date().toISOString();
      }

      task.results.push(result);
      this.emit("result", result);
      return result;
    });

    await Promise.allSettled(promises);

    task.status = task.results.some(r => !r.error) ? "completed" : "failed";
    task.summary = mergeResults(task, this.config.mergeStrategy);
    this.emit("complete", task);

    return task;
  }
}
