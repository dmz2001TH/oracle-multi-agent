/**
 * Agent Lineage Tracking — The Yeast Model
 * Parent → Child identity tracking. Budding an agent inherits history.
 * Based on: Agents That Remember (Soul Brews Studio)
 */
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const LINEAGE_DIR = join(homedir(), ".oracle", "lineage");

export interface AgentNode {
  id: string; name: string; role: string;
  parentId: string | null;    // null = root agent
  generation: number;          // 0 = original, 1+ = bud
  bornAt: string;
  diedAt?: string;
  status: "alive" | "sleeping" | "dead" | "archived";
  children: string[];          // child agent ids
  inheritedSkills: string[];   // skills from parent
  tags?: string[];
}

export interface LineageTree {
  rootId: string;
  nodes: Map<string, AgentNode>;
}

function ensureDir() { mkdirSync(LINEAGE_DIR, { recursive: true }); }
function registryFile() { return join(LINEAGE_DIR, "registry.jsonl"); }
function treeFile(rootId: string) { return join(LINEAGE_DIR, `tree-${rootId}.json`); }

/** Register a new root agent (no parent) */
export function registerAgent(name: string, role: string, tags?: string[]): AgentNode {
  ensureDir();
  const node: AgentNode = {
    id: `agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name, role, parentId: null, generation: 0,
    bornAt: new Date().toISOString(), status: "alive",
    children: [], inheritedSkills: [], tags,
  };
  appendFileSync(registryFile(), JSON.stringify(node) + "\n");
  writeFileSync(treeFile(node.id), JSON.stringify({ rootId: node.id, nodes: [node] }, null, 2));
  return node;
}

/** Bud a child agent from a parent — inherits parent's skills & context */
export function budFrom(parentId: string, childName: string, childRole?: string): AgentNode | null {
  ensureDir();
  const parent = findAgent(parentId);
  if (!parent) return null;

  const child: AgentNode = {
    id: `agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name: childName, role: childRole || parent.role,
    parentId, generation: parent.generation + 1,
    bornAt: new Date().toISOString(), status: "alive",
    children: [], inheritedSkills: [...parent.inheritedSkills],
    tags: parent.tags,
  };

  // Update parent's children list
  parent.children.push(child.id);
  updateAgent(parent);

  // Register child
  appendFileSync(registryFile(), JSON.stringify(child) + "\n");

  // Update tree file
  const tf = treeFile(getRootId(parentId));
  if (existsSync(tf)) {
    const tree = JSON.parse(readFileSync(tf, "utf-8"));
    tree.nodes.push(child);
    tree.nodes = tree.nodes.map((n: AgentNode) => n.id === parent.id ? parent : n);
    writeFileSync(tf, JSON.stringify(tree, null, 2));
  }

  return child;
}

/** Find an agent by ID or name */
export function findAgent(idOrName: string): AgentNode | null {
  const f = registryFile();
  if (!existsSync(f)) return null;
  const lines = readFileSync(f, "utf-8").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const node: AgentNode = JSON.parse(line);
      if (node.id === idOrName || node.name === idOrName) return node;
    } catch {}
  }
  return null;
}

/** Get the root ancestor of an agent */
export function getRootId(agentId: string): string {
  const agent = findAgent(agentId);
  if (!agent) return agentId;
  if (!agent.parentId) return agent.id;
  return getRootId(agent.parentId);
}

/** Get full ancestry chain: agent → parent → grandparent → ... */
export function getAncestry(agentId: string): AgentNode[] {
  const chain: AgentNode[] = [];
  let current = findAgent(agentId);
  while (current) {
    chain.push(current);
    current = current.parentId ? findAgent(current.parentId) : null;
  }
  return chain;
}

/** Get all descendants of an agent */
export function getDescendants(agentId: string): AgentNode[] {
  const agent = findAgent(agentId);
  if (!agent) return [];
  const descendants: AgentNode[] = [];
  const queue = [...agent.children];
  while (queue.length > 0) {
    const childId = queue.shift()!;
    const child = findAgent(childId);
    if (child) {
      descendants.push(child);
      queue.push(...child.children);
    }
  }
  return descendants;
}

/** Mark agent as dead/archived */
export function killAgent(agentId: string, status: "dead" | "archived" = "dead"): boolean {
  const agent = findAgent(agentId);
  if (!agent) return false;
  agent.status = status;
  agent.diedAt = new Date().toISOString();
  updateAgent(agent);
  return true;
}

/** Get all agents */
export function listAllAgents(): AgentNode[] {
  const f = registryFile();
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf-8").split("\n").filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

/** Get alive agents */
export function listAlive(): AgentNode[] {
  return listAllAgents().filter(a => a.status === "alive");
}

/** Get lineage stats */
export function getStats(): { total: number; alive: number; dead: number; maxGeneration: number; trees: number } {
  const all = listAllAgents();
  return {
    total: all.length,
    alive: all.filter(a => a.status === "alive").length,
    dead: all.filter(a => a.status === "dead" || a.status === "archived").length,
    maxGeneration: all.reduce((max, a) => Math.max(max, a.generation), 0),
    trees: new Set(all.filter(a => !a.parentId).map(a => a.id)).size,
  };
}

/** Format lineage as tree string */
export function formatTree(rootId: string): string {
  const root = findAgent(rootId);
  if (!root) return `Agent ${rootId} not found`;

  const lines: string[] = [];
  const walk = (node: AgentNode, prefix: string, isLast: boolean) => {
    const connector = isLast ? "└── " : "├── ";
    const icon = node.status === "alive" ? "🟢" : node.status === "sleeping" ? "😴" : "💀";
    lines.push(`${prefix}${connector}${icon} ${node.name} (${node.role}) gen:${node.generation}`);
    const childPrefix = prefix + (isLast ? "    " : "│   ");
    node.children.forEach((childId, i) => {
      const child = findAgent(childId);
      if (child) walk(child, childPrefix, i === node.children.length - 1);
    });
  };

  const icon = root.status === "alive" ? "🟢" : "💀";
  lines.push(`${icon} ${root.name} (${root.role}) gen:${root.generation}`);
  root.children.forEach((childId, i) => {
    const child = findAgent(childId);
    if (child) walk(child, "", i === root.children.length - 1);
  });

  return lines.join("\n");
}

function updateAgent(node: AgentNode): void {
  const f = registryFile();
  if (!existsSync(f)) return;
  const lines = readFileSync(f, "utf-8").split("\n").filter(Boolean);
  const updated = lines.map(l => {
    try {
      const n = JSON.parse(l);
      return n.id === node.id ? JSON.stringify(node) : l;
    } catch { return l; }
  });
  writeFileSync(f, updated.join("\n") + "\n");
}
