import { capturePane } from "../ssh.js";
import { tmux } from "../tmux.js";
import type { MawWS } from "../types.js";

type SessionInfo = { name: string; windows: { index: number; name: string; active: boolean }[] };

export async function pushCapture(ws: MawWS, lastContent: Map<MawWS, string>) {
  if (!ws.data.target) return;
  try {
    const content = await capturePane(ws.data.target, 80);
    const prev = lastContent.get(ws);
    if (content !== prev) {
      lastContent.set(ws, content);
      ws.send(JSON.stringify({ type: "capture", target: ws.data.target, content }));
    }
  } catch (e: any) { ws.send(JSON.stringify({ type: "error", error: e.message })); }
}

export async function pushPreviews(ws: MawWS, lastPreviews: Map<MawWS, Map<string, string>>) {
  const targets = ws.data.previewTargets;
  if (!targets || targets.size === 0) return;
  const prevMap = lastPreviews.get(ws) || new Map<string, string>();
  const changed: Record<string, string> = {};
  let hasChanges = false;
  await Promise.allSettled([...targets].map(async (target) => {
    try {
      const content = await capturePane(target, 15);
      if (content !== prevMap.get(target)) { prevMap.set(target, content); changed[target] = content; hasChanges = true; }
    } catch {}
  }));
  lastPreviews.set(ws, prevMap);
  if (hasChanges) ws.send(JSON.stringify({ type: "previews", data: changed }));
}

export async function broadcastSessions(
  clients: Set<MawWS>,
  cache: { sessions: SessionInfo[]; json: string },
  peerSessions: SessionInfo[] = [],
): Promise<SessionInfo[]> {
  if (clients.size === 0) return cache.sessions;
  try {
    const local = await tmux.listAll();
    const all = peerSessions.length > 0 ? [...local, ...peerSessions] : local;
    cache.sessions = local;
    const msg = JSON.stringify({ type: "sessions", sessions: all });
    for (const ws of clients) ws.send(msg);
    return local;
  } catch { return cache.sessions; }
}

export async function sendBusyAgents(ws: MawWS, sessions: SessionInfo[]) {
  const allTargets = sessions.flatMap(s => s.windows.map(w => `${s.name}:${w.index}`));
  const busy: { target: string; name: string; session: string }[] = [];
  for (const t of allTargets) {
    try {
      const cmd = await tmux.getPaneCommand(t);
      if (/claude|codex|node/i.test(cmd)) {
        const [session] = t.split(":");
        const s = sessions.find(x => x.name === session);
        const w = s?.windows.find(w => `${s.name}:${w.index}` === t);
        busy.push({ target: t, name: w?.name || t, session });
      }
    } catch {}
  }
  if (busy.length > 0) ws.send(JSON.stringify({ type: "recent", agents: busy }));
}
