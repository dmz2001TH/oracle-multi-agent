import { capturePane } from "../ssh.js";
import { tmux } from "../tmux.js";
import type { FeedEvent } from "../lib/feed.js";
import type { MawWS } from "../types.js";
import { createHash } from "crypto";

interface AgentState { hash: string; changedAt: number; status: string; wasRunning: boolean; }

const realFeedLastSeen = new Map<string, number>();
const REAL_FEED_TTL = 60_000;

export function markRealFeedEvent(oracleName: string) {
  realFeedLastSeen.set(oracleName, Date.now());
}

export interface CrashedAgent { target: string; name: string; session: string; }

interface SessionInfo { name: string; windows: { index: number; name: string; active: boolean }[]; }

function stripStatusBar(content: string): string {
  return content.split("\n").filter(line => {
    const plain = line.replace(/\x1b\[[0-9;]*m/g, "");
    if (/^[\s─━]+$/.test(plain)) return false;
    if (/📁|📡|⏵/.test(plain)) return false;
    if (/^\s*❯\s*$/.test(plain)) return false;
    if (/current:.*latest:|bypass permissions|auto-accept/.test(plain)) return false;
    if (/^\s*$/.test(plain)) return false;
    return true;
  }).join("\n");
}

function hashContent(content: string): string {
  return createHash("md5").update(stripStatusBar(content)).digest("hex");
}

export class StatusDetector {
  private state = new Map<string, AgentState>();

  async detect(
    sessions: SessionInfo[],
    clients: Set<MawWS>,
    feedListeners: Set<(event: FeedEvent) => void>,
  ) {
    if (clients.size === 0 || sessions.length === 0) return;

    const agents = sessions.flatMap(s =>
      s.windows.map(w => ({ target: `${s.name}:${w.index}`, name: w.name, session: s.name }))
    );

    const cmds: Record<string, string> = {};
    for (const a of agents) {
      try { cmds[a.target] = await tmux.getPaneCommand(a.target); } catch {}
    }

    const needsCapture = agents.filter(a => !/claude|codex|node/i.test(cmds[a.target] || ""));
    const captures = await Promise.allSettled(
      needsCapture.map(async a => ({ target: a.target, content: await capturePane(a.target, 20) }))
    );
    const contentMap = new Map<string, string>();
    for (const r of captures) { if (r.status === "fulfilled") contentMap.set(r.value.target, r.value.content); }

    const now = Date.now();
    for (const { target, name, session } of agents) {
      const cmd = (cmds[target] || "").toLowerCase();
      const isAgent = /claude|codex|node/i.test(cmd);
      const isShell = /^(zsh|bash|sh|fish)$/.test(cmd.trim());

      if (isAgent) {
        const prev = this.state.get(target);
        this.state.set(target, { hash: prev?.hash || "", changedAt: prev?.changedAt || now, status: prev?.status || "ready", wasRunning: true });
        continue;
      }

      const content = contentMap.get(target) || "";
      const hash = hashContent(content);
      const prev = this.state.get(target);

      let status: string;
      if (!isAgent && isShell && prev?.wasRunning) status = "crashed";
      else if (!isAgent) status = "idle";
      else if (!prev || hash !== prev.hash) status = "busy";
      else if (now - prev.changedAt < 15_000) status = "busy";
      else status = "ready";

      const changedAt = (!prev || hash !== prev.hash) ? now : prev.changedAt;
      this.state.set(target, { hash, changedAt, status, wasRunning: isAgent ? true : (prev?.wasRunning ?? false) });

      if (prev && status !== prev.status) {
        const oracleName = name.replace(/-oracle$/, "");
        const lastReal = realFeedLastSeen.get(oracleName) || 0;
        if (now - lastReal >= REAL_FEED_TTL) {
          const event: FeedEvent = {
            timestamp: new Date().toISOString(), oracle: oracleName, host: "local",
            event: status === "busy" ? "PreToolUse" : status === "ready" ? "Stop" : status === "crashed" ? "Notification" : "SessionEnd",
            project: session, sessionId: "",
            message: status === "busy" ? "working" : status === "ready" ? "waiting" : status === "crashed" ? "crash" : "idle",
            ts: now,
          };
          for (const ws of clients) ws.send(JSON.stringify({ type: "feed", event }));
          for (const fn of feedListeners) fn(event);
        }
      }
    }
    this.pruneState(sessions);
  }

  getStatus(target: string): string | null { return this.state.get(target)?.status ?? null; }

  getCrashedAgents(sessions: SessionInfo[]): CrashedAgent[] {
    const result: CrashedAgent[] = [];
    for (const s of sessions) for (const w of s.windows) {
      const target = `${s.name}:${w.index}`;
      if (this.state.get(target)?.status === "crashed") result.push({ target, name: w.name, session: s.name });
    }
    return result;
  }

  clearCrashed(target: string) {
    const s = this.state.get(target);
    if (s) { s.wasRunning = false; s.status = "idle"; }
  }

  pruneState(sessions: SessionInfo[]) {
    const activeTargets = new Set<string>();
    for (const s of sessions) for (const w of s.windows) activeTargets.add(`${s.name}:${w.index}`);
    for (const key of this.state.keys()) { if (!activeTargets.has(key)) this.state.delete(key); }
    const now = Date.now();
    for (const [oracle, ts] of realFeedLastSeen) { if (now - ts > 3_600_000) realFeedLastSeen.delete(oracle); }
  }
}
