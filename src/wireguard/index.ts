/**
 * WireGuard P2P Transport — Peer-to-peer agent messaging
 * Based on: The Agent Bus Chapter 9 — Federation Over WireGuard
 * 
 * Provides P2P transport layer for cross-machine agent communication
 * without a central hub. Uses WireGuard for encrypted tunnel.
 */

import { execSync } from "child_process";

export interface WireGuardPeer {
  name: string;
  publicKey: string;
  endpoint: string;     // ip:port
  allowedIPs: string[]; // CIDR ranges
  persistentKeepalive?: number;
  status: "connected" | "disconnected" | "unknown";
  lastHandshake?: string;
  transferRx?: number;
  transferTx?: number;
}

export interface WireGuardInterface {
  name: string;         // e.g., "wg0"
  privateKey?: string;  // redacted in output
  publicKey: string;
  listenPort: number;
  peers: WireGuardPeer[];
  status: "up" | "down";
}

export interface FederationConfig {
  nodeName: string;
  interface: string;    // wg interface name
  token: string;        // HMAC secret for signing
  peers: { name: string; endpoint: string; publicKey: string; allowedIPs: string[] }[];
}

/**
 * Check if WireGuard is available on this system.
 */
export function isWireGuardAvailable(): boolean {
  try {
    execSync("which wg 2>/dev/null", { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get WireGuard interface status.
 */
export function getInterfaceStatus(iface: string = "wg0"): WireGuardInterface | null {
  if (!isWireGuardAvailable()) return null;

  try {
    const raw = execSync(`wg show ${iface} 2>/dev/null`, { encoding: "utf-8", timeout: 5000 }).trim();
    if (!raw) return null;

    const lines = raw.split("\n");
    const wg: WireGuardInterface = {
      name: iface, publicKey: "", listenPort: 0, peers: [], status: "up",
    };

    let currentPeer: Partial<WireGuardPeer> | null = null;

    for (const line of lines) {
      const [key, ...valueParts] = line.split(":");
      const value = valueParts.join(":").trim();

      if (key.trim() === "public key") wg.publicKey = value;
      else if (key.trim() === "listening port") wg.listenPort = parseInt(value);
      else if (key.trim() === "peer") {
        if (currentPeer?.publicKey) wg.peers.push(currentPeer as WireGuardPeer);
        currentPeer = { publicKey: value, name: value.slice(0, 8), allowedIPs: [], status: "unknown" };
      }
      else if (key.trim() === "endpoint" && currentPeer) currentPeer.endpoint = value;
      else if (key.trim() === "allowed ips" && currentPeer) currentPeer.allowedIPs = value.split(", ").map(s => s.trim());
      else if (key.trim() === "latest handshake" && currentPeer) {
        currentPeer.lastHandshake = value;
        currentPeer.status = value !== "none" ? "connected" : "disconnected";
      }
      else if (key.trim() === "transfer" && currentPeer) {
        const match = value.match(/([\d.]+)\s*(\w+)\s*received.*?([\d.]+)\s*(\w+)\s*sent/);
        if (match) {
          currentPeer.transferRx = parseFloat(match[1]) * unitMultiplier(match[2]);
          currentPeer.transferTx = parseFloat(match[3]) * unitMultiplier(match[4]);
        }
      }
    }

    if (currentPeer?.publicKey) wg.peers.push(currentPeer as WireGuardPeer);
    return wg;
  } catch {
    return null;
  }
}

function unitMultiplier(unit: string): number {
  switch (unit.toLowerCase()) {
    case "b": return 1;
    case "kib": return 1024;
    case "mib": return 1024 * 1024;
    case "gib": return 1024 * 1024 * 1024;
    default: return 1;
  }
}

/**
 * Ping a peer via WireGuard tunnel.
 */
export function pingPeer(peerEndpoint: string, timeout: number = 3): { ok: boolean; rtt?: number; error?: string } {
  try {
    const host = peerEndpoint.split(":")[0];
    const raw = execSync(
      `ping -c 1 -W ${timeout} ${host} 2>/dev/null`,
      { encoding: "utf-8", timeout: (timeout + 2) * 1000 }
    ).trim();
    const match = raw.match(/time=([\d.]+)\s*ms/);
    return { ok: true, rtt: match ? parseFloat(match[1]) : undefined };
  } catch (err: any) {
    return { ok: false, error: err.message?.substring(0, 100) };
  }
}

/**
 * Get federation status across all peers.
 */
export function getFederationStatus(config: FederationConfig): {
  node: string;
  interface: WireGuardInterface | null;
  peers: { name: string; status: string; ping?: number }[];
} {
  const iface = getInterfaceStatus(config.interface);

  const peers = config.peers.map(p => {
    const wgPeer = iface?.peers.find(w => w.publicKey === p.publicKey);
    const ping = pingPeer(p.endpoint);
    return {
      name: p.name,
      status: ping.ok ? "reachable" : "unreachable",
      ping: ping.rtt,
      wgStatus: wgPeer?.status || "unknown",
    };
  });

  return {
    node: config.nodeName,
    interface: iface,
    peers,
  };
}

/**
 * Generate WireGuard config file for a node.
 */
export function generateConfig(config: FederationConfig, privateKey: string): string {
  const lines = [
    "[Interface]",
    `PrivateKey = ${privateKey}`,
    `ListenPort = 51820`,
    "",
  ];

  for (const peer of config.peers) {
    lines.push("[Peer]");
    lines.push(`PublicKey = ${peer.publicKey}`);
    lines.push(`Endpoint = ${peer.endpoint}`);
    lines.push(`AllowedIPs = ${peer.allowedIPs.join(", ")}`);
    lines.push(`PersistentKeepalive = 25`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Format federation status as string.
 */
export function formatFederationStatus(status: ReturnType<typeof getFederationStatus>): string {
  const lines = [
    `🌐 **Federation Status** — ${status.node}`,
    `Interface: ${status.interface?.name || "N/A"} (${status.interface?.status || "unknown"})`,
    "",
    "### Peers",
  ];

  for (const peer of status.peers) {
    const icon = peer.status === "reachable" ? "🟢" : "🔴";
    const pingStr = peer.ping ? ` (${peer.ping.toFixed(1)}ms)` : "";
    lines.push(`${icon} **${peer.name}** — ${peer.status}${pingStr}`);
  }

  return lines.join("\n");
}
