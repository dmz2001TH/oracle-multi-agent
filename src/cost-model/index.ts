/**
 * Cost Model by Tier — Track token costs per orchestration tier
 * Based on: Multi-Agent Orchestration Book Appendix C — Cost Analysis
 */

export interface CostEntry {
  id: string;
  ts: string;
  agent: string;
  tier: "in-process" | "mailbox" | "tmux" | "federation";
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  task?: string;
}

export interface TierCostSummary {
  tier: CostEntry["tier"];
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgCostPerRequest: number;
  models: Record<string, { requests: number; cost: number }>;
}

export interface CostReport {
  period: { from: string; to: string };
  byTier: TierCostSummary[];
  byAgent: Record<string, { requests: number; cost: number }>;
  totals: { requests: number; inputTokens: number; outputTokens: number; costUsd: number };
  projectedMonthly: number;
}

// Model pricing per 1K tokens (input, output)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4": { input: 0.03, output: 0.06 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  "gemini-2.0-flash": { input: 0.000075, output: 0.0003 },
  "gemini-1.5-pro": { input: 0.00125, output: 0.005 },
  "claude-3-opus": { input: 0.015, output: 0.075 },
  "claude-3-sonnet": { input: 0.003, output: 0.015 },
  "claude-3-haiku": { input: 0.00025, output: 0.00125 },
  "mimo-v2-pro": { input: 0.0001, output: 0.0002 },
  "mimo-v2-lite": { input: 0.00005, output: 0.0001 },
};

/**
 * Calculate cost for a token usage.
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || { input: 0.001, output: 0.002 };
  return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
}

/**
 * Log a cost entry.
 */
export function logCost(
  agent: string,
  tier: CostEntry["tier"],
  model: string,
  inputTokens: number,
  outputTokens: number,
  task?: string
): CostEntry {
  const entry: CostEntry = {
    id: `cost-${Date.now().toString(36)}`,
    ts: new Date().toISOString(),
    agent, tier, model,
    inputTokens, outputTokens,
    costUsd: calculateCost(model, inputTokens, outputTokens),
    task,
  };
  return entry;
}

/**
 * Generate cost report from entries.
 */
export function generateReport(entries: CostEntry[], from?: string, to?: string): CostReport {
  const now = new Date().toISOString();
  const filtered = entries.filter(e => {
    if (from && e.ts < from) return false;
    if (to && e.ts > to) return false;
    return true;
  });

  // Group by tier
  const tierMap = new Map<string, TierCostSummary>();
  for (const tier of ["in-process", "mailbox", "tmux", "federation"] as const) {
    tierMap.set(tier, {
      tier, totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0,
      totalCostUsd: 0, avgCostPerRequest: 0, models: {},
    });
  }

  const agentMap: Record<string, { requests: number; cost: number }> = {};

  for (const entry of filtered) {
    const tier = tierMap.get(entry.tier)!;
    tier.totalRequests++;
    tier.totalInputTokens += entry.inputTokens;
    tier.totalOutputTokens += entry.outputTokens;
    tier.totalCostUsd += entry.costUsd;

    if (!tier.models[entry.model]) tier.models[entry.model] = { requests: 0, cost: 0 };
    tier.models[entry.model].requests++;
    tier.models[entry.model].cost += entry.costUsd;

    if (!agentMap[entry.agent]) agentMap[entry.agent] = { requests: 0, cost: 0 };
    agentMap[entry.agent].requests++;
    agentMap[entry.agent].cost += entry.costUsd;
  }

  // Calculate averages
  for (const [, tier] of tierMap) {
    tier.avgCostPerRequest = tier.totalRequests > 0 ? tier.totalCostUsd / tier.totalRequests : 0;
  }

  // Calculate totals
  const totals = {
    requests: filtered.length,
    inputTokens: filtered.reduce((s, e) => s + e.inputTokens, 0),
    outputTokens: filtered.reduce((s, e) => s + e.outputTokens, 0),
    costUsd: filtered.reduce((s, e) => s + e.costUsd, 0),
  };

  // Project monthly (based on available data span)
  let projectedMonthly = 0;
  if (filtered.length > 1) {
    const first = new Date(filtered[0].ts).getTime();
    const last = new Date(filtered[filtered.length - 1].ts).getTime();
    const spanMs = last - first;
    if (spanMs > 0) {
      const msPerMonth = 30 * 24 * 60 * 60 * 1000;
      projectedMonthly = (totals.costUsd / spanMs) * msPerMonth;
    }
  }

  return {
    period: { from: from || filtered[0]?.ts || now, to: to || now },
    byTier: Array.from(tierMap.values()),
    byAgent: agentMap,
    totals,
    projectedMonthly,
  };
}

/**
 * Format cost report as readable string.
 */
export function formatCostReport(report: CostReport): string {
  const lines = [
    `💰 **Cost Report**`,
    `Period: ${report.period.from.split("T")[0]} → ${report.period.to.split("T")[0]}`,
    "",
    `### Totals`,
    `- Requests: ${report.totals.requests.toLocaleString()}`,
    `- Input tokens: ${report.totals.inputTokens.toLocaleString()}`,
    `- Output tokens: ${report.totals.outputTokens.toLocaleString()}`,
    `- **Cost: $${report.totals.costUsd.toFixed(4)}**`,
    `- Projected monthly: $${report.projectedMonthly.toFixed(2)}`,
    "",
    `### By Tier`,
  ];

  for (const tier of report.byTier) {
    if (tier.totalRequests === 0) continue;
    lines.push(`**${tier.tier}**: ${tier.totalRequests} reqs, $${tier.totalCostUsd.toFixed(4)} (avg $${tier.avgCostPerRequest.toFixed(6)}/req)`);
  }

  lines.push("", "### By Agent");
  const sorted = Object.entries(report.byAgent).sort((a, b) => b[1].cost - a[1].cost);
  for (const [agent, stats] of sorted.slice(0, 10)) {
    lines.push(`- **${agent}**: ${stats.requests} reqs, $${stats.cost.toFixed(4)}`);
  }

  return lines.join("\n");
}
