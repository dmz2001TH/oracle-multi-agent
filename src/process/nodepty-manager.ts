/**
 * NodePty Process Manager — uses node-pty for Windows native process management.
 * Fallback when tmux is not available.
 */

import type { ProcessManager, ProcessHandle, ProcessInfo } from "./index.js";

// Dynamic import for node-pty (optional dependency)
let ptyModule: typeof import("node-pty") | null = null;
try {
  ptyModule = await import("node-pty");
} catch {
  // node-pty not available — this manager won't work
}

interface PtyProcess {
  pty: any; // node-pty IPty
  buffer: string[];
  name: string;
}

function getDefaultShell(): { cmd: string; args: string[] } {
  if (process.platform === "win32") {
    return { cmd: "powershell.exe", args: ["-NoLogo", "-NoProfile"] };
  }
  return { cmd: process.env.SHELL || "bash", args: ["-l"] };
}

export class NodePtyManager implements ProcessManager {
  private processes = new Map<string, PtyProcess>();
  private maxBufferSize = 5000;

  async spawn(name: string, command: string, opts?: { cwd?: string; env?: Record<string, string> }): Promise<ProcessHandle> {
    if (!ptyModule) throw new Error("node-pty not available — install with: npm install node-pty");

    const shell = getDefaultShell();
    const pty = ptyModule.spawn(shell.cmd, shell.args, {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd: opts?.cwd || process.cwd(),
      env: { ...process.env, ...opts?.env } as Record<string, string>,
    });

    const proc: PtyProcess = { pty, buffer: [], name };
    this.processes.set(name, proc);

    pty.onData((data: string) => {
      proc.buffer.push(data);
      if (proc.buffer.length > this.maxBufferSize) {
        proc.buffer.shift();
      }
    });

    // Wait a bit for shell to initialize, then send the command
    await new Promise(r => setTimeout(r, 300));
    await this.sendText(name, command);

    return new NodePtyHandle(name, this);
  }

  async sendText(target: string, text: string): Promise<void> {
    const proc = this.processes.get(target);
    if (!proc) throw new Error(`process not found: ${target}`);
    proc.pty.write(text + "\r");
  }

  async capture(_target: string, lines = 80): Promise<string> {
    const proc = this.processes.get(_target);
    if (!proc) return "";
    const content = proc.buffer.join("");
    const allLines = content.split("\n");
    return allLines.slice(-lines).join("\n");
  }

  async kill(target: string): Promise<void> {
    const proc = this.processes.get(target);
    if (!proc) return;
    try { proc.pty.kill(); } catch {}
    this.processes.delete(target);
  }

  async killAll(): Promise<void> {
    for (const [name, proc] of this.processes) {
      try { proc.pty.kill(); } catch {}
      this.processes.delete(name);
    }
  }

  async list(): Promise<ProcessInfo[]> {
    const sessions: ProcessInfo[] = [];
    for (const [name] of this.processes) {
      sessions.push({
        name,
        windows: [{ index: 0, name, active: true }],
      });
    }
    return sessions;
  }

  async listWindows(session?: string): Promise<ProcessInfo[]> {
    if (session) {
      if (this.processes.has(session)) {
        return [{ name: session, windows: [{ index: 0, name: session, active: true }] }];
      }
      return [];
    }
    return this.list();
  }

  async isActive(target: string): Promise<boolean> {
    return this.processes.has(target);
  }
}

class NodePtyHandle implements ProcessHandle {
  constructor(public name: string, private manager: NodePtyManager) {}

  async sendText(text: string): Promise<void> {
    await this.manager.sendText(this.name, text);
  }

  async capture(lines = 80): Promise<string> {
    return this.manager.capture(this.name, lines);
  }

  async kill(): Promise<void> {
    await this.manager.kill(this.name);
  }

  isActive(): boolean {
    return true;
  }
}
