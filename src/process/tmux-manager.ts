/**
 * Tmux Process Manager — uses tmux CLI for process orchestration.
 * Works on Linux, Mac, and WSL.
 */

import { execa } from "execa";
import type { ProcessManager, ProcessHandle, ProcessInfo } from "./index.js";

function q(s: string | number): string {
  const str = String(s);
  if (/^[a-zA-Z0-9_.:\-\/]+$/.test(str)) return str;
  return `'${str.replace(/'/g, "'\\''")}'`;
}

async function tmuxExec(...args: string[]): Promise<string> {
  const { stdout } = await execa("tmux", args, { reject: true });
  return stdout.trim();
}

async function tmuxTry(...args: string[]): Promise<string> {
  try {
    const { stdout } = await execa("tmux", args, { reject: false });
    return stdout.trim();
  } catch { return ""; }
}

export class TmuxManager implements ProcessManager {
  async spawn(name: string, command: string, opts?: { cwd?: string; env?: Record<string, string> }): Promise<ProcessHandle> {
    const args = ["new-session", "-d", "-s", name];
    if (opts?.cwd) args.push("-c", opts.cwd);
    await tmuxExec(...args);
    await tmuxTry("set-option", "-t", name, "renumber-windows", "on");

    // Send the command to the first window
    const target = `${name}:0`;
    await tmuxExec("send-keys", "-t", target, command, "Enter");

    return new TmuxHandle(name, target);
  }

  async sendText(target: string, text: string): Promise<void> {
    if (text.includes("\n") || text.length > 500) {
      // Buffer method for multiline
      const escaped = text.replace(/'/g, "'\\''");
      await execa("bash", ["-c", `printf '%s' '${escaped}' | tmux load-buffer -`]);
      await tmuxExec("paste-buffer", "-t", target);
      await tmuxExec("send-keys", "-t", target, "Enter");
      await new Promise(r => setTimeout(r, 500));
      await tmuxExec("send-keys", "-t", target, "Enter");
    } else {
      await tmuxExec("send-keys", "-t", target, "-l", text);
      await tmuxExec("send-keys", "-t", target, "Enter");
      await new Promise(r => setTimeout(r, 500));
      await tmuxExec("send-keys", "-t", target, "Enter");
    }
  }

  async capture(target: string, lines = 80): Promise<string> {
    if (lines > 50) {
      return tmuxExec("capture-pane", "-t", target, "-e", "-p", "-S", `-${lines}`);
    }
    const { stdout } = await execa("bash", ["-c", `tmux capture-pane -t ${q(target)} -e -p 2>/dev/null | tail -${lines}`]);
    return stdout.trim();
  }

  async kill(target: string): Promise<void> {
    // target can be session:window or session
    if (target.includes(":")) {
      await tmuxTry("kill-window", "-t", target);
    } else {
      await tmuxTry("kill-session", "-t", target);
    }
  }

  async killAll(): Promise<void> {
    try {
      const raw = await tmuxTry("list-sessions", "-F", "#{session_name}");
      for (const s of raw.split("\n").filter(Boolean)) {
        if (s.startsWith("maw-") || s.startsWith("oracle-")) {
          await tmuxTry("kill-session", "-t", s);
        }
      }
    } catch {}
  }

  async list(): Promise<ProcessInfo[]> {
    try {
      const raw = await tmuxTry("list-sessions", "-F", "#{session_name}");
      const sessions: ProcessInfo[] = [];
      for (const name of raw.split("\n").filter(Boolean)) {
        const windows = await this._listWindows(name);
        sessions.push({ name, windows });
      }
      return sessions;
    } catch { return []; }
  }

  async listWindows(session?: string): Promise<ProcessInfo[]> {
    if (session) {
      const windows = await this._listWindows(session);
      return [{ name: session, windows }];
    }
    return this.list();
  }

  async isActive(target: string): Promise<boolean> {
    try {
      await tmuxExec("has-session", "-t", target);
      return true;
    } catch { return false; }
  }

  private async _listWindows(session: string): Promise<ProcessInfo["windows"]> {
    try {
      const raw = await tmuxExec("list-windows", "-t", session, "-F", "#{window_index}:#{window_name}:#{window_active}");
      return raw.split("\n").filter(Boolean).map(w => {
        const [idx, name, active] = w.split(":");
        return { index: +idx, name, active: active === "1" };
      });
    } catch { return []; }
  }
}

class TmuxHandle implements ProcessHandle {
  constructor(public name: string, private target: string) {}

  async sendText(text: string): Promise<void> {
    const mgr = new TmuxManager();
    await mgr.sendText(this.target, text);
  }

  async capture(lines = 80): Promise<string> {
    const mgr = new TmuxManager();
    return mgr.capture(this.target, lines);
  }

  async kill(): Promise<void> {
    const mgr = new TmuxManager();
    await mgr.kill(this.target);
  }

  isActive(): boolean {
    // Sync check — caller should use manager.isActive for async
    return true;
  }
}
