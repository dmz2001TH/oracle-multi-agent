/**
 * Multi-Agent Workflow Kit
 *
 * Orchestration patterns for multi-agent workflows:
 * - Sequential: Agent A → Agent B → Agent C
 * - Parallel: Agent A + B + C → merge results
 * - Fan-out: Split task → distribute → collect
 * - Review: Agent does work → Agent reviews → approve/reject
 * - Pipeline: Chain of transformations
 *
 * Adapted from multi-agent-workflow-kit patterns (Python → TypeScript)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkflowStep {
  id: string;
  name: string;
  role: string;
  task: string;
  dependsOn?: string[];
  timeout?: number;
}

export interface WorkflowResult {
  stepId: string;
  status: "success" | "failed" | "skipped";
  output: string;
  duration: number;
  error?: string;
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  pattern: "sequential" | "parallel" | "fan-out" | "review" | "pipeline";
  steps: WorkflowStep[];
}

// ─── Sequential Workflow ────────────────────────────────────────────────────

export async function runSequential(
  steps: WorkflowStep[],
  executor: (step: WorkflowStep, context: Record<string, string>) => Promise<string>
): Promise<WorkflowResult[]> {
  const results: WorkflowResult[] = [];
  const context: Record<string, string> = {};

  for (const step of steps) {
    const start = Date.now();
    try {
      // Check dependencies
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          const depResult = results.find(r => r.stepId === dep);
          if (!depResult || depResult.status === "failed") {
            results.push({
              stepId: step.id,
              status: "skipped",
              output: "",
              duration: 0,
              error: `Dependency ${dep} ${depResult ? "failed" : "not found"}`,
            });
            continue;
          }
        }
      }

      const output = await executor(step, context);
      context[step.id] = output;
      results.push({
        stepId: step.id,
        status: "success",
        output,
        duration: Date.now() - start,
      });
    } catch (e: any) {
      results.push({
        stepId: step.id,
        status: "failed",
        output: "",
        duration: Date.now() - start,
        error: e.message,
      });
    }
  }

  return results;
}

// ─── Parallel Workflow ──────────────────────────────────────────────────────

export async function runParallel(
  steps: WorkflowStep[],
  executor: (step: WorkflowStep, context: Record<string, string>) => Promise<string>
): Promise<WorkflowResult[]> {
  const context: Record<string, string> = {};

  const promises = steps.map(async (step): Promise<WorkflowResult> => {
    const start = Date.now();
    try {
      const output = await executor(step, context);
      context[step.id] = output;
      return { stepId: step.id, status: "success", output, duration: Date.now() - start };
    } catch (e: any) {
      return { stepId: step.id, status: "failed", output: "", duration: Date.now() - start, error: e.message };
    }
  });

  return Promise.all(promises);
}

// ─── Fan-out / Fan-in Workflow ──────────────────────────────────────────────

export async function runFanOut(
  task: string,
  workerCount: number,
  splitter: (task: string, count: number) => string[],
  executor: (subtask: string, workerIndex: number) => Promise<string>,
  merger: (results: string[]) => string
): Promise<{ merged: string; details: WorkflowResult[] }> {
  const subtasks = splitter(task, workerCount);
  const details: WorkflowResult[] = [];

  const promises = subtasks.map(async (subtask, i) => {
    const start = Date.now();
    try {
      const output = await executor(subtask, i);
      const result: WorkflowResult = { stepId: `worker-${i}`, status: "success", output, duration: Date.now() - start };
      details.push(result);
      return output;
    } catch (e: any) {
      const result: WorkflowResult = { stepId: `worker-${i}`, status: "failed", output: "", duration: Date.now() - start, error: e.message };
      details.push(result);
      return "";
    }
  });

  const outputs = await Promise.all(promises);
  const merged = merger(outputs.filter(Boolean));

  return { merged, details };
}

// ─── Review Workflow ────────────────────────────────────────────────────────

export async function runReview(
  task: string,
  doer: (task: string) => Promise<string>,
  reviewer: (task: string, output: string) => Promise<{ approved: boolean; feedback: string }>,
  maxRetries: number = 2
): Promise<{ final: string; rounds: number; approved: boolean }> {
  let currentOutput = "";
  let rounds = 0;

  for (let i = 0; i <= maxRetries; i++) {
    rounds = i + 1;
    currentOutput = await doer(i === 0 ? task : `${task}\n\nFeedback: ${currentOutput}`);
    const review = await reviewer(task, currentOutput);

    if (review.approved) {
      return { final: currentOutput, rounds, approved: true };
    }
    currentOutput = review.feedback;
  }

  return { final: currentOutput, rounds, approved: false };
}

// ─── Pipeline Workflow ──────────────────────────────────────────────────────

export async function runPipeline<T>(
  input: T,
  stages: Array<(input: any) => Promise<any>>
): Promise<{ output: T; stageResults: Array<{ stage: number; duration: number; error?: string }> }> {
  let current: any = input;
  const stageResults: Array<{ stage: number; duration: number; error?: string }> = [];

  for (let i = 0; i < stages.length; i++) {
    const start = Date.now();
    try {
      current = await stages[i](current);
      stageResults.push({ stage: i, duration: Date.now() - start });
    } catch (e: any) {
      stageResults.push({ stage: i, duration: Date.now() - start, error: e.message });
      return { output: current, stageResults };
    }
  }

  return { output: current, stageResults };
}

// ─── Workflow Definitions (pre-built) ──────────────────────────────────────

export const WORKFLOW_TEMPLATES: WorkflowDefinition[] = [
  {
    name: "research-report",
    description: "Research a topic → analyze → write report",
    pattern: "sequential",
    steps: [
      { id: "research", name: "Research", role: "researcher", task: "Research the given topic thoroughly" },
      { id: "analyze", name: "Analyze", role: "data-analyst", task: "Analyze research findings, identify patterns", dependsOn: ["research"] },
      { id: "write", name: "Write Report", role: "writer", task: "Write a clear, structured report from analysis", dependsOn: ["analyze"] },
    ],
  },
  {
    name: "code-review",
    description: "Write code → review → fix → approve",
    pattern: "review",
    steps: [
      { id: "implement", name: "Implement", role: "coder", task: "Implement the requested feature" },
      { id: "review", name: "Review", role: "qa-tester", task: "Review code quality, security, edge cases", dependsOn: ["implement"] },
      { id: "fix", name: "Fix Issues", role: "coder", task: "Fix issues found in review", dependsOn: ["review"] },
    ],
  },
  {
    name: "parallel-analysis",
    description: "Analyze multiple aspects in parallel, merge results",
    pattern: "parallel",
    steps: [
      { id: "security", name: "Security Audit", role: "qa-tester", task: "Check for security vulnerabilities" },
      { id: "performance", name: "Performance", role: "data-analyst", task: "Analyze performance metrics" },
      { id: "ux", name: "UX Review", role: "writer", task: "Review user experience" },
    ],
  },
  {
    name: "translate-verify",
    description: "Translate content → verify accuracy",
    pattern: "sequential",
    steps: [
      { id: "translate", name: "Translate", role: "translator", task: "Translate content to target language" },
      { id: "verify", name: "Verify", role: "qa-tester", task: "Verify translation accuracy and cultural fit", dependsOn: ["translate"] },
    ],
  },
  {
    name: "deploy-pipeline",
    description: "Build → test → deploy → verify",
    pattern: "pipeline",
    steps: [
      { id: "build", name: "Build", role: "coder", task: "Build and compile" },
      { id: "test", name: "Test", role: "qa-tester", task: "Run tests", dependsOn: ["build"] },
      { id: "deploy", name: "Deploy", role: "devops", task: "Deploy to production", dependsOn: ["test"] },
      { id: "verify", name: "Verify", role: "qa-tester", task: "Verify deployment health", dependsOn: ["deploy"] },
    ],
  },
];

export function getWorkflowTemplate(name: string): WorkflowDefinition | undefined {
  return WORKFLOW_TEMPLATES.find(t => t.name === name);
}

export function listWorkflowTemplates(): { name: string; description: string; pattern: string; steps: number }[] {
  return WORKFLOW_TEMPLATES.map(t => ({
    name: t.name,
    description: t.description,
    pattern: t.pattern,
    steps: t.steps.length,
  }));
}
