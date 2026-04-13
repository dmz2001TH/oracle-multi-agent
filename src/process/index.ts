/**
 * Process Management Abstraction — cross-platform process orchestration.
 *
 * Provides a unified interface for managing agent processes across:
 *   - tmux (Linux/Mac/WSL)
 *   - node-pty (Windows native)
 */

export interface ProcessInfo {
  name: string;
  windows: { index: number; name: string; active: boolean; cwd?: string }[];
}

export interface ProcessHandle {
  name: string;
  sendText(text: string): Promise<void>;
  capture(lines?: number): Promise<string>;
  kill(): Promise<void>;
  isActive(): boolean;
}

export interface ProcessManager {
  spawn(name: string, command: string, opts?: { cwd?: string; env?: Record<string, string> }): Promise<ProcessHandle>;
  sendText(target: string, text: string): Promise<void>;
  capture(target: string, lines?: number): Promise<string>;
  kill(target: string): Promise<void>;
  killAll(): Promise<void>;
  list(): Promise<ProcessInfo[]>;
  listWindows(session?: string): Promise<ProcessInfo[]>;
  isActive(target: string): Promise<boolean>;
}
