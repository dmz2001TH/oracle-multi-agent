/**
 * Fleet Oracle Scan — Auto-discover agents across nodes
 * Based on: maw-js oracle scan pattern
 */
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";

export interface DiscoveredAgent {
  name: string;
  source: "tmux" | "file" | "registry" | "peer";
  session?: string;
  status: "running" | "idle" | "unknown";
  lastSeen: string;
  metadata?: Record<string, any>;
}

export interface FleetReport {
  timestamp: string;
  localNode: string;
  agents: DiscoveredAgent[];
  sources: { tmux: number; file: number; registry: number; peer: number };
  totalAgents: number;
}

/**
 * Scan for agents via tmux sessions.
 */
function scanTmux(): DiscoveredAgent[] {
  const agents: DiscoveredAgent[] = [];
  try {
    const raw = execSync(
      "tmux list-sessions -F '#{session_name}:#{session_attached}:#{session_windows}' 2>/dev/null",
      { encoding: "utf-8", timeout: 5000 }
    ).trim();
    if (!raw) return agents;

    for (const line of raw.split("\n")) {
      const [name, attached, windows] = line.split(":");
      if (!name) continue;
      agents.push({
        name,
        source: "tmux",
        session: name,
        status: attached === "1" ? "running" : "idle",
        lastSeen: new Date().toISOString(),
        metadata: { windows: parseInt(windows) || 0, attached: attached === "1" },
      });
    }
  } catch {}
  return agents;
}

/**
 * Scan for agents via file system (identity files, heartbeat, etc).
 */
function scanFiles(): DiscoveredAgent[] {
  const agents: DiscoveredAgent[] = [];
  const oracleDir = join(homedir(), ".oracle");
  const agentsDir = join(oracleDir, "agents");

  // Check identity file
  const identityFile = join(oracleDir, "identity.json");
  if (existsSync(identityFile)) {
    try {
      const id = JSON.parse(readFileSync(identityFile, "utf-8"));
      agents.push({
        name: id.name || "oracle",
        source: "file",
        status: "idle",
        lastSeen: id.awakenedAt || new Date().toISOString(),
        metadata: { role: id.role, element: id.element, awakenCount: id.awakenCount },
      });
    } catch {}
  }

  // Check agent directories
  if (existsSync(agentsDir)) {
    try {
      const dirs = readdirSync(agentsDir);
      for (const dir of dirs) {
        const hbFile = join(agentsDir, dir, "heartbeat.json");
        let status: DiscoveredAgent["status"] = "unknown";
        let lastSeen = new Date().toISOString();

        if (existsSync(hbFile)) {
          try {
            const hb = JSON.parse(readFileSync(hbFile, "utf-8"));
            status = hb.status || "unknown";
            lastSeen = hb.lastBeat || lastSeen;
          } catch {}
        }

        // Skip if already found in identity
        if (agents.some(a => a.name === dir)) continue;

        agents.push({
          name: dir,
          source: "file",
          status,
          lastSeen,
          metadata: { dir: join(agentsDir, dir) },
        });
      }
    } catch {}
  }

  return agents;
}

/**
 * Scan for agents via registry (lineage system).
 */
function scanRegistry(): DiscoveredAgent[] {
  const agents: DiscoveredAgent[] = [];
  const lineageFile = join(homedir(), ".oracle", "lineage", "registry.jsonl");

  if (!existsSync(lineageFile)) return agents;

  try {
    const lines = readFileSync(lineageFile, "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const node = JSON.parse(line);
        // Don't duplicate agents already found
        if (agents.some(a => a.name === node.name)) continue;
        agents.push({
          name: node.name,
          source: "registry",
          status: node.status === "alive" ? "running" : node.status === "sleeping" ? "idle" : "unknown",
          lastSeen: node.bornAt,
          metadata: { role: node.role, generation: node.generation, parentId: node.parentId },
        });
      } catch {}
    }
  } catch {}

  return agents;
}

/**
 * Scan for peer agents (federation).
 */
function scanPeers(): DiscoveredAgent[] {
  const agents: DiscoveredAgent[] = [];

  // Check maw.config.json for peer configuration
  const configPaths = [
    join(process.cwd(), "maw.config.json"),
    join(homedir(), ".oracle", "maw.config.json"),
  ];

  for (const configPath of configPaths) {
    if (!existsSync(configPath)) continue;
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      const peers = config.namedPeers || config.peers || [];
      for (const peer of peers) {
        const name = typeof peer === "string" ? peer : peer.name;
        const url = typeof peer === "string" ? peer : peer.url;
        if (!name) continue;
        agents.push({
          name,
          source: "peer",
          status: "unknown",
          lastSeen: new Date().toISOString(),
          metadata: { url, type: "federation-peer" },
        });
      }
    } catch {}
  }

  return agents;
}

/**
 * Run a full fleet scan across all sources.
 */
export function scanFleet(nodeName?: string): FleetReport {
  const tmuxAgents = scanTmux();
  const fileAgents = scanFiles();
  const registryAgents = scanRegistry();
  const peerAgents = scanPeers();

  // Merge and deduplicate
  const all = new Map<string, DiscoveredAgent>();
  const addAgent = (agent: DiscoveredAgent) => {
    const existing = all.get(agent.name);
    if (!existing || existing.source === "registry" || existing.source === "file") {
      all.set(agent.name, agent);
    }
  };

  for (const a of [...tmuxAgents, ...fileAgents, ...registryAgents, ...peerAgents]) {
    addAgent(a);
  }

  const agents = Array.from(all.values());

  return {
    timestamp: new Date().toISOString(),
    localNode: nodeName || "local",
    agents,
    sources: {
      tmux: tmuxAgents.length,
      file: fileAgents.length,
      registry: registryAgents.length,
      peer: peerAgents.length,
    },
    totalAgents: agents.length,
  };
}

/**
 * Format fleet report as string.
 */
export function formatFleetReport(report: FleetReport): string {
  const bySource = {
    tmux: report.agents.filter(a => a.source === "tmux"),
    file: report.agents.filter(a => a.source === "file"),
    registry: report.agents.filter(a => a.source === "registry"),
    peer: report.agents.filter(a => a.source === "peer"),
  };

  const lines = [
    `🚢 **Fleet Scan** — ${report.timestamp}`,
    `Node: ${report.localNode}`,
    `Total: ${report.totalAgents} agents`,
    "",
    `Sources: tmux(${report.sources.tmux}) file(${report.sources.file}) registry(${report.sources.registry}) peer(${report.sources.peer})`,
    "",
  ];

  for (const [source, agents] of Object.entries(bySource)) {
    if (agents.length === 0) continue;
    lines.push(`### ${source.charAt(0).toUpperCase() + source.slice(1)} (${agents.length})`);
    for (const a of agents) {
      const icon = a.status === "running" ? "🟢" : a.status === "idle" ? "🟡" : "❓";
      const meta = a.metadata?.role ? ` (${a.metadata.role})` : "";
      lines.push(`${icon} **${a.name}**${meta} — ${a.status}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
