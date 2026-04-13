/**
 * Minimal SDK stub for WASM bridge compatibility.
 */

export const maw = {
  async send(target: string, text: string): Promise<void> {
    const { cmdSend } = await import("./commands/comm.js");
    await cmdSend(target, text);
  },
  async identity(): Promise<Record<string, unknown>> {
    try {
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();
      return { host: cfg.host, agents: cfg.agents, peers: cfg.peers };
    } catch { return { error: "unavailable" }; }
  },
  async federation(): Promise<Record<string, unknown>> {
    try {
      const { loadConfig } = await import("./config.js");
      const cfg = loadConfig();
      return { peers: cfg.peers || [], namedPeers: cfg.namedPeers || [], federationToken: cfg.federationToken ? "****" : null };
    } catch { return { error: "unavailable" }; }
  },
};
