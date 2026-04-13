import type { FeedEvent } from "./lib/feed.js";
import { fire, markAgentActive, checkIdleTriggers, getTriggers } from "./triggers.js";

export function setupTriggerListener(feedListeners: Set<(event: FeedEvent) => void>): void {
  feedListeners.add((event: FeedEvent) => {
    if (event.oracle) markAgentActive(event.oracle);
    switch (event.event) {
      case "SessionStart": fire("agent-wake", { agent: event.oracle }); break;
      case "Notification":
        if (event.message.toLowerCase().includes("crash")) fire("agent-crash", { agent: event.oracle });
        break;
    }
  });
  const idleTriggers = getTriggers().filter(t => t.on === "agent-idle");
  if (idleTriggers.length > 0) setInterval(() => { checkIdleTriggers(); }, 15_000);
}
