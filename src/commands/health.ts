import { execSync } from "child_process";
import { loadConfig, cfgTimeout } from "../config.js";
import { curlFetch } from "../curl-fetch.js";
import { tmux } from "../tmux.js";
import { hasTmux, devNull, isWindows } from "../platform.js";

function getDiskInfo(): { status: string; detail: string } {
  try {
    if (isWindows) {
      const out = execSync("wmic logicaldisk get size,freespace,caption 2>NUL", { encoding: "utf-8" }).trim();
      const lines = out.split("\n").filter(l => l.trim() && !/Caption/i.test(l));
      if (lines.length > 0) {
        const parts = lines[0].trim().split(/\s+/);
        const freeGB = Math.round(parseInt(parts[1] || "0") / 1e9);
        return { status: freeGB < 5 ? "warn" : "ok", detail: `${freeGB}GB free` };
      }
      return { status: "warn", detail: "unknown" };
    }
    const df = execSync("df -h /tmp | tail -1", { encoding: "utf-8" }).trim();
    const parts = df.split(/\s+/);
    const avail = parts[3] || "?";
    const pct = parseInt(parts[4] || "0");
    return { status: pct > 90 ? "warn" : "ok", detail: `${avail} free` };
  } catch {
    return { status: "warn", detail: "unknown" };
  }
}

function getMemoryInfo(): { status: string; detail: string } {
  try {
    if (isWindows) {
      const out = execSync("wmic os get FreePhysicalMemory /value 2>NUL", { encoding: "utf-8" }).trim();
      const match = out.match(/FreePhysicalMemory=(\d+)/);
      if (match) {
        const availMB = Math.round(parseInt(match[1]) / 1024);
        return { status: availMB < 500 ? "warn" : "ok", detail: `${availMB}MB available` };
      }
      return { status: "warn", detail: "unknown" };
    }
    const mem = execSync("free -m | grep Mem", { encoding: "utf-8" }).trim();
    const parts = mem.split(/\s+/);
    const avail = parseInt(parts[6] || "0");
    return { status: avail < 500 ? "warn" : "ok", detail: `${avail}MB available` };
  } catch {
    return { status: "warn", detail: "unknown" };
  }
}

export async function cmdHealth() {
  const checks: { name: string; status: string; detail: string }[] = [];

  // 1. tmux
  if (hasTmux()) {
    try {
      const sessions = await tmux.listSessions();
      checks.push({ name: "tmux server", status: "ok", detail: `running (${sessions.length} sessions)` });
    } catch {
      checks.push({ name: "tmux server", status: "fail", detail: "not running" });
    }
  } else {
    checks.push({ name: "tmux server", status: "none", detail: "not available (using node-pty)" });
  }

  // 2. maw server
  try {
    const config = loadConfig();
    const port = config.port;
    const res = await fetch(`http://localhost:${port}/api/sessions`, { signal: AbortSignal.timeout(cfgTimeout("health")) });
    if (res.ok) {
      const data = await res.json();
      const count = Array.isArray(data) ? data.length : (data.sessions?.length || 0);
      checks.push({ name: "maw server", status: "ok", detail: `online (:${port}, ${count} sessions)` });
    } else {
      checks.push({ name: "maw server", status: "warn", detail: `HTTP ${res.status}` });
    }
  } catch {
    checks.push({ name: "maw server", status: "fail", detail: "offline" });
  }

  // 3. disk
  checks.push({ name: "disk", ...getDiskInfo() });

  // 4. memory
  checks.push({ name: "memory", ...getMemoryInfo() });

  // 5. pm2
  try {
    const pm2 = execSync(`pm2 jlist 2>${devNull}`, { encoding: "utf-8" });
    const procs = JSON.parse(pm2);
    const maw = procs.find((p: any) => p.name === "maw");
    if (maw) {
      checks.push({ name: "pm2 maw", status: maw.pm2_env?.status === "online" ? "ok" : "warn", detail: `${maw.pm2_env?.status} (pid ${maw.pid})` });
    } else {
      checks.push({ name: "pm2 maw", status: "fail", detail: "not found" });
    }
  } catch {
    checks.push({ name: "pm2 maw", status: "warn", detail: "pm2 not available" });
  }

  // 6. peers
  const config = loadConfig();
  const peers = (config as any).peers || [];
  if (peers.length === 0) {
    checks.push({ name: "peers", status: "none", detail: "none configured" });
  } else {
    for (const peer of peers) {
      try {
        const r = await curlFetch(`${peer}/api/federation/status`, { timeout: cfgTimeout("health") });
        checks.push({ name: `peer ${peer}`, status: r.ok ? "ok" : "warn", detail: r.ok ? "online" : `HTTP ${r.status}` });
      } catch {
        checks.push({ name: `peer ${peer}`, status: "fail", detail: "unreachable" });
      }
    }
  }

  // Output
  console.log("\nmaw health\n");
  for (const c of checks) {
    const icon = c.status === "ok" ? "\x1b[32m●\x1b[0m" : c.status === "warn" ? "\x1b[33m●\x1b[0m" : c.status === "fail" ? "\x1b[31m●\x1b[0m" : "\x1b[90m○\x1b[0m";
    console.log(`  ${icon} ${c.name.padEnd(18)} ${c.detail}`);
  }
  console.log();
}
