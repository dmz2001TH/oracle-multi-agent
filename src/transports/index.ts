/**
 * Transport registry — creates and wires all transports from config.
 */

import { loadConfig } from "../config.js";
import { TransportRouter } from "../transport.js";
import { TmuxTransport } from "./tmux.js";
import { HttpTransport } from "./http.js";
import { HubTransport, loadWorkspaceConfigs } from "./hub.js";
import { LoRaTransport } from "./lora.js";
import { NanoclawTransport } from "./nanoclaw.js";

let router: TransportRouter | null = null;

export function createTransportRouter(): TransportRouter {
  if (router) return router;
  const config = loadConfig();
  router = new TransportRouter();

  // 1. Tmux (local fast path) — always available
  const tmux = new TmuxTransport();
  tmux.connect().catch(() => {});
  router.register(tmux);

  // 2. Hub transport — workspace WebSocket connections
  if (loadWorkspaceConfigs().length > 0) router.register(new HubTransport(config.node));

  // 3. HTTP federation fallback
  if (config.peers && config.peers.length > 0) {
    router.register(new HttpTransport({ peers: config.peers, selfHost: config.node ?? "local" }));
  }

  // 4. NanoClaw (external chat channels)
  router.register(new NanoclawTransport());

  // 5. LoRa (future — stub)
  router.register(new LoRaTransport());

  return router;
}

export function getTransportRouter(): TransportRouter { return router || createTransportRouter(); }

export function resetTransportRouter() {
  if (router) { router.disconnectAll().catch(() => {}); router = null; }
}

export { TmuxTransport } from "./tmux.js";
export { HubTransport } from "./hub.js";
export { HttpTransport } from "./http.js";
export { NanoclawTransport } from "./nanoclaw.js";
export { LoRaTransport } from "./lora.js";
