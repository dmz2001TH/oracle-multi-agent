import { findWindow, type Session } from "./find-window.js";
import type { MawConfig } from "./config.js";

export type ResolveResult =
  | { type: "local"; target: string }
  | { type: "peer"; peerUrl: string; target: string; node: string }
  | { type: "self-node"; target: string }
  | { type: "error"; reason: string; detail: string; hint?: string }
  | null;

export function resolveTarget(query: string, config: MawConfig, sessions: Session[]): ResolveResult {
  if (!query) return { type: "error", reason: "empty_query", detail: "no target specified", hint: "usage: oracle hey <agent> <message>" };
  const selfNode = config.node ?? "local";
  const localTarget = findWindow(sessions, query);
  if (localTarget) return { type: "local", target: localTarget };

  if (query.includes(":") && !query.includes("/")) {
    const colonIdx = query.indexOf(":");
    const nodeName = query.slice(0, colonIdx);
    const agentName = query.slice(colonIdx + 1);
    if (!nodeName || !agentName) return { type: "error", reason: "empty_node_or_agent", detail: `invalid format: '${query}'`, hint: "use node:agent format" };
    if (nodeName === selfNode) {
      const selfTarget = findWindow(sessions, agentName);
      if (selfTarget) return { type: "self-node", target: selfTarget };
      return { type: "error", reason: "self_not_running", detail: `'${agentName}' not found locally on ${selfNode}` };
    }
    const peerUrl = findPeerUrl(nodeName, config);
    if (peerUrl) return { type: "peer", peerUrl, target: agentName, node: nodeName };
    return { type: "error", reason: "unknown_node", detail: `node '${nodeName}' not in namedPeers or peers` };
  }

  const agentNode = config.agents?.[query] || config.agents?.[query.replace(/-oracle$/, "")];
  if (agentNode) {
    if (agentNode === selfNode) return { type: "error", reason: "self_not_running", detail: `'${query}' mapped to ${selfNode} but not in sessions` };
    const peerUrl = findPeerUrl(agentNode, config);
    if (peerUrl) return { type: "peer", peerUrl, target: query, node: agentNode };
    return { type: "error", reason: "no_peer_url", detail: `'${query}' mapped to '${agentNode}' but no URL found` };
  }

  return { type: "error", reason: "not_found", detail: `'${query}' not in local sessions or agents map` };
}

function findPeerUrl(nodeName: string, config: MawConfig): string | undefined {
  const peer = config.namedPeers?.find((p) => p.name === nodeName);
  if (peer) return peer.url;
  return config.peers?.find((p) => p.includes(nodeName));
}
