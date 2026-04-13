export interface Window { index: number; name: string; active: boolean; }
export interface Session { name: string; windows: Window[]; }

function matchSession(sessions: Session[], part: string, strict = false): Session | null {
  const p = part.toLowerCase();
  if (!p) return null;
  for (const s of sessions) if (s.name.toLowerCase() === p) return s;
  for (const s of sessions) if (s.name.toLowerCase().replace(/^\d+-/, "") === p) return s;
  if (!strict) for (const s of sessions) if (s.name.toLowerCase().includes(p)) return s;
  return null;
}

export function findWindow(sessions: Session[], query: string): string | null {
  const q = query.toLowerCase();
  if (query.includes(":")) {
    const [sessPart, winPart] = q.split(":", 2);
    const sess = matchSession(sessions, sessPart, true);
    if (sess) {
      if (!winPart) { if (sess.windows.length > 0) return `${sess.name}:${sess.windows[0].index}`; }
      else { for (const w of sess.windows) if (w.name.toLowerCase().includes(winPart)) return `${sess.name}:${w.index}`; }
    }
  }
  for (const s of sessions) for (const w of s.windows) if (w.name.toLowerCase().includes(q)) return `${s.name}:${w.index}`;
  for (const s of sessions) if (s.name.toLowerCase().includes(q) && s.windows.length > 0) return `${s.name}:${s.windows[0].index}`;
  if (query.includes(":")) {
    const [sessPart] = query.toLowerCase().split(":", 2);
    return matchSession(sessions, sessPart, true) ? query : null;
  }
  return null;
}
