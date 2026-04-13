import { hostExec } from "./ssh.js";
import { loadConfig, cfgLimit } from "./config.js";

export function resolveSocket(): string | undefined {
  return process.env.ORACLE_TMUX_SOCKET || loadConfig().tmuxSocket || undefined;
}

export const tmuxCmd = resolveSocket;

function q(s: string | number): string {
  const str = String(s);
  if (/^[a-zA-Z0-9_.:\-\/]+$/.test(str)) return str;
  return `'${str.replace(/'/g, "'\\''")}'`;
}

export interface TmuxPane { id: string; command: string; target: string; title: string; pid?: number; cwd?: string; }
export interface TmuxWindow { index: number; name: string; active: boolean; cwd?: string; }
export interface TmuxSession { name: string; windows: TmuxWindow[]; }

export class Tmux {
  private socket?: string;
  constructor(private host?: string, socket?: string) {
    this.socket = socket !== undefined ? socket : resolveSocket();
  }

  async run(subcommand: string, ...args: (string | number)[]): Promise<string> {
    const socketFlag = this.socket ? `-S ${q(this.socket)} ` : "";
    return hostExec(`tmux ${socketFlag}${subcommand} ${args.map(q).join(" ")}`, this.host);
  }

  async tryRun(subcommand: string, ...args: (string | number)[]): Promise<string> {
    return this.run(subcommand, ...args).catch(() => "");
  }

  async listSessions(): Promise<TmuxSession[]> {
    try {
      const raw = await this.run("list-sessions", "-F", "#{session_name}");
      const sessions: TmuxSession[] = [];
      for (const s of raw.split("\n").filter(Boolean)) {
        sessions.push({ name: s, windows: await this.listWindows(s) });
      }
      return sessions;
    } catch { return []; }
  }

  async listAll(): Promise<TmuxSession[]> {
    try {
      const raw = await this.run("list-windows", "-a", "-F", "#{session_name}|||#{window_index}|||#{window_name}|||#{window_active}|||#{pane_current_path}");
      const map = new Map<string, TmuxWindow[]>();
      for (const line of raw.split("\n").filter(Boolean)) {
        const [session, idx, name, active, cwd] = line.split("|||");
        if (!map.has(session)) map.set(session, []);
        map.get(session)!.push({ index: +idx, name, active: active === "1", cwd: cwd || undefined });
      }
      return [...map.entries()].map(([name, windows]) => ({ name, windows }));
    } catch { return []; }
  }

  async hasSession(name: string): Promise<boolean> {
    try { await this.run("has-session", "-t", name); return true; }
    catch { return false; }
  }

  async newSession(name: string, opts: { window?: string; cwd?: string; detached?: boolean } = {}): Promise<void> {
    const args: (string | number)[] = [];
    if (opts.detached !== false) args.push("-d");
    args.push("-s", name);
    if (opts.window) args.push("-n", opts.window);
    if (opts.cwd) args.push("-c", opts.cwd);
    await this.run("new-session", ...args);
    await this.setOption(name, "renumber-windows", "on");
  }

  async newGroupedSession(parent: string, name: string, opts: { cols: number; rows: number; window?: string }): Promise<void> {
    await this.run("new-session", "-d", "-t", parent, "-s", name, "-x", opts.cols, "-y", opts.rows);
    if (opts.window) await this.selectWindow(`${name}:${opts.window}`);
  }

  async killSession(name: string): Promise<void> { await this.tryRun("kill-session", "-t", name); }

  async listWindows(session: string): Promise<TmuxWindow[]> {
    const raw = await this.run("list-windows", "-t", session, "-F", "#{window_index}:#{window_name}:#{window_active}");
    return raw.split("\n").filter(Boolean).map(w => {
      const [idx, name, active] = w.split(":");
      return { index: +idx, name, active: active === "1" };
    });
  }

  async newWindow(session: string, name: string, opts: { cwd?: string } = {}): Promise<void> {
    const args: (string | number)[] = ["-t", `${session}:`, "-n", name];
    if (opts.cwd) args.push("-c", opts.cwd);
    await this.run("new-window", ...args);
  }

  async selectWindow(target: string): Promise<void> { await this.tryRun("select-window", "-t", target); }
  async switchClient(session: string): Promise<void> { await this.tryRun("switch-client", "-t", session); }
  async killWindow(target: string): Promise<void> { await this.tryRun("kill-window", "-t", target); }

  async listPanes(): Promise<TmuxPane[]> {
    try {
      const raw = await this.run("list-panes", "-a", "-F", "#{pane_id}|||#{pane_current_command}|||#{session_name}:#{window_index}.#{pane_index}|||#{pane_title}|||#{pane_pid}|||#{pane_current_path}");
      return raw.split("\n").filter(Boolean).map(line => {
        const [id, command, target, title, pid, cwd] = line.split("|||");
        return { id, command, target, title, pid: pid ? Number(pid) : undefined, cwd: cwd || undefined };
      });
    } catch { return []; }
  }

  async listPaneIds(): Promise<Set<string>> {
    try {
      const raw = await this.run("list-panes", "-a", "-F", "#{pane_id}");
      return new Set(raw.split("\n").filter(Boolean));
    } catch { return new Set(); }
  }

  async killPane(target: string): Promise<void> { await this.tryRun("kill-pane", "-t", target); }

  async getPaneCommand(target: string): Promise<string> {
    const raw = await this.run("list-panes", "-t", target, "-F", "#{pane_current_command}");
    return raw.split("\n")[0] || "";
  }

  async getPaneCommands(targets: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    try {
      const raw = await this.run("list-panes", "-a", "-F", "#{session_name}:#{window_index}|||#{pane_current_command}");
      for (const line of raw.split("\n").filter(Boolean)) {
        const [target, cmd] = line.split("|||");
        if (targets.includes(target)) result[target] = cmd || "";
      }
    } catch {}
    return result;
  }

  async capture(target: string, lines = 80): Promise<string> {
    if (lines > 50) return this.run("capture-pane", "-t", target, "-e", "-p", "-S", -lines);
    const socketFlag = this.socket ? `-S ${q(this.socket)} ` : "";
    return hostExec(`tmux ${socketFlag}capture-pane -t ${q(target)} -e -p 2>/dev/null | tail -${lines}`, this.host);
  }

  async resizePane(target: string, cols: number, rows: number): Promise<void> {
    const c = Math.max(1, Math.min(cfgLimit("ptyCols"), Math.floor(cols)));
    const r = Math.max(1, Math.min(cfgLimit("ptyRows"), Math.floor(rows)));
    await this.tryRun("resize-pane", "-t", target, "-x", c, "-y", r);
  }

  async splitWindow(target: string): Promise<void> { await this.run("split-window", "-t", target); }

  async selectPane(target: string, opts: { title?: string } = {}): Promise<void> {
    const args: (string | number)[] = ["-t", target];
    if (opts.title) args.push("-T", opts.title);
    await this.run("select-pane", ...args);
  }

  async selectLayout(target: string, layout: string): Promise<void> {
    await this.run("select-layout", "-t", target, layout);
  }

  async sendKeys(target: string, ...keys: string[]): Promise<void> {
    await this.run("send-keys", "-t", target, ...keys);
  }

  async sendKeysLiteral(target: string, text: string): Promise<void> {
    await this.run("send-keys", "-t", target, "-l", text);
  }

  async loadBuffer(text: string): Promise<void> {
    const escaped = text.replace(/'/g, "'\\''");
    const socketFlag = this.socket ? `-S ${q(this.socket)} ` : "";
    await hostExec(`printf '%s' '${escaped}' | tmux ${socketFlag}load-buffer -`, this.host);
  }

  async pasteBuffer(target: string): Promise<void> { await this.run("paste-buffer", "-t", target); }

  async sendText(target: string, text: string): Promise<void> {
    if (text.includes("\n") || text.length > 500) {
      await this.loadBuffer(text);
      await this.pasteBuffer(target);
      await this.sendKeys(target, "Enter");
      await new Promise(r => setTimeout(r, 500));
      await this.sendKeys(target, "Enter");
    } else {
      await this.sendKeysLiteral(target, text);
      await this.sendKeys(target, "Enter");
      await new Promise(r => setTimeout(r, 500));
      await this.sendKeys(target, "Enter");
    }
  }

  async setEnvironment(session: string, key: string, value: string): Promise<void> {
    await this.run("set-environment", "-t", session, key, value);
  }

  async setOption(target: string, option: string, value: string): Promise<void> {
    await this.tryRun("set-option", "-t", target, option, value);
  }

  async set(target: string, option: string, value: string): Promise<void> {
    await this.tryRun("set", "-t", target, option, value);
  }
}

export const tmux = new Tmux();
