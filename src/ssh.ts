import { loadConfig } from "./config.js";
import { execa } from "execa";

const DEFAULT_HOST = process.env.ORACLE_HOST || loadConfig().host || "local";

export async function hostExec(cmd: string, host = DEFAULT_HOST): Promise<string> {
  const local = host === "local" || host === "localhost";
  if (local) {
    const { stdout } = await execa("bash", ["-c", cmd], { reject: true });
    return stdout.trim();
  }
  const { stdout } = await execa("ssh", [host, cmd], { reject: true });
  return stdout.trim();
}

export interface SessionWindow { index: number; name: string; active: boolean; }
export interface Session { name: string; windows: SessionWindow[]; }

function tmuxCmd(): string {
  const socket = process.env.ORACLE_TMUX_SOCKET || loadConfig().tmuxSocket;
  return socket ? `tmux -S '${socket}'` : "tmux";
}

export async function listSessions(host?: string): Promise<Session[]> {
  let raw: string;
  try { raw = await hostExec(`${tmuxCmd()} list-sessions -F '#{session_name}' 2>/dev/null`, host); }
  catch { return []; }
  const sessions: Session[] = [];
  for (const s of raw.split("\n").filter(Boolean)) {
    try {
      const winRaw = await hostExec(`${tmuxCmd()} list-windows -t '${s}' -F '#{window_index}:#{window_name}:#{window_active}' 2>/dev/null`, host);
      const windows = winRaw.split("\n").filter(Boolean).map(w => {
        const [idx, name, active] = w.split(":");
        return { index: +idx, name, active: active === "1" };
      });
      sessions.push({ name: s, windows });
    } catch { sessions.push({ name: s, windows: [] }); }
  }
  return sessions;
}

export async function capturePane(target: string, lines = 80, host?: string): Promise<string> {
  if (lines > 50) return hostExec(`${tmuxCmd()} capture-pane -t '${target}' -e -p -S -${lines} 2>/dev/null`, host);
  return hostExec(`${tmuxCmd()} capture-pane -t '${target}' -e -p 2>/dev/null | tail -${lines}`, host);
}

export async function selectWindow(target: string, host?: string): Promise<void> {
  await hostExec(`${tmuxCmd()} select-window -t '${target}' 2>/dev/null`, host).catch(() => {});
}

export async function sendKeys(target: string, text: string, host?: string): Promise<void> {
  const { Tmux } = await import("./tmux.js");
  const t = new Tmux(host);

  const SPECIAL: Record<string, string> = {
    "\x1b": "Escape", "\x1b[A": "Up", "\x1b[B": "Down",
    "\x1b[C": "Right", "\x1b[D": "Left", "\r": "Enter",
    "\n": "Enter", "\b": "BSpace", "\x15": "C-u",
  };
  if (SPECIAL[text]) { await t.sendKeys(target, SPECIAL[text]); return; }

  const endsWithEnter = text.endsWith("\r") || text.endsWith("\n");
  const body = endsWithEnter ? text.slice(0, -1) : text;
  if (!body) { await t.sendKeys(target, "Enter"); return; }

  if (body.startsWith("/")) {
    for (const ch of body) await t.sendKeysLiteral(target, ch);
    await t.sendKeys(target, "Enter");
  } else {
    await t.sendText(target, body);
  }
}

export async function capture(target: string, lines = 80, host?: string): Promise<string> {
  return capturePane(target, lines, host);
}

export async function getPaneCommand(target: string, host?: string): Promise<string> {
  const { Tmux } = await import("./tmux.js");
  const t = new Tmux(host);
  return t.getPaneCommand(target);
}

export async function getPaneCommands(targets: string[], host?: string): Promise<Record<string, string>> {
  const { Tmux } = await import("./tmux.js");
  const t = new Tmux(host);
  const result: Record<string, string> = {};
  for (const t2 of targets) {
    try { result[t2] = await t.getPaneCommand(t2); } catch {}
  }
  return result;
}

export async function getPaneInfos(targets: string[], host?: string): Promise<Record<string, { command: string; cwd: string }>> {
  const { Tmux } = await import("./tmux.js");
  const t = new Tmux(host);
  const result: Record<string, { command: string; cwd: string }> = {};
  for (const t2 of targets) {
    try {
      const raw = await t.run("list-panes", "-t", t2, "-F", "#{pane_current_command}\t#{pane_current_path}");
      const [command = "", cwd = ""] = raw.split("\n")[0]?.split("\t") || [];
      result[t2] = { command, cwd };
    } catch {}
  }
  return result;
}
