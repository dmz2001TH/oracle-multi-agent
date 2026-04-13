#!/usr/bin/env node
process.env.MAW_CLI = "1";

import { cmdPeek, cmdSend } from "./commands/comm.js";
import { logAudit } from "./audit.js";
import { usage } from "./cli/usage.js";
import { routeComm } from "./cli/route-comm.js";
import { routeAgent } from "./cli/route-agent.js";
import { routeFleet } from "./cli/route-fleet.js";
import { routeWorkspace } from "./cli/route-workspace.js";
import { routeTools } from "./cli/route-tools.js";
import { routeTeam } from "./cli/route-team.js";
import { routeTasks } from "./cli/route-tasks.js";
import { routeSpawn } from "./cli/route-spawn.js";
import { routeCron } from "./cli/route-cron.js";
import { routeAgentsStatus } from "./cli/route-agents-status.js";
import { routeWorktreeOps } from "./cli/route-worktree-ops.js";
import { routeMergeTeam } from "./cli/route-merge-team.js";
import { routeWakeup } from "./cli/route-wakeup.js";
import { routeOverview } from "./cli/route-overview.js";
import { scanCommands, matchCommand, executeCommand } from "./cli/command-registry.js";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const cmd = args[0]?.toLowerCase();

logAudit(cmd || "", args);

function getVersionString(): string {
  let pkg: { version: string; repository?: string };
  try {
    pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
  } catch { pkg = { version: "5.0.0" }; }

  let hash = "";
  try { hash = execSync("git rev-parse --short HEAD", { cwd: __dirname, stdio: "pipe" }).toString().trim(); } catch {}
  let buildDate = "";
  try {
    const raw = execSync("git log -1 --format=%ci", { cwd: __dirname, stdio: "pipe" }).toString().trim();
    const d = new Date(raw);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    buildDate = `${raw.slice(0, 10)} ${days[d.getDay()]} ${raw.slice(11, 16)}`;
  } catch {}
  return `oracle v${pkg.version}${hash ? ` (${hash})` : ""}${buildDate ? ` built ${buildDate}` : ""}`;
}

if (cmd === "--version" || cmd === "-v" || cmd === "version") {
  console.log(getVersionString());
} else if (cmd === "update" || cmd === "upgrade") {
  const ref = args[1] || "main";
  const before = getVersionString();
  console.log(`\n  🍺 oracle update ${ref}\n`);
  console.log(`  from: ${before}`);
  try { execSync("npm uninstall -g oracle-multi-agent", { stdio: "pipe" }); } catch {}
  try {
    let pkg: { repository?: string };
    try { pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8")); } catch { pkg = {}; }
    const repo = pkg.repository || "dmz2001TH/oracle-multi-agent";
    execSync(`npm install -g github:${repo}#${ref}`, { stdio: "inherit" });
  } catch (err: any) {
    console.error(`  ✗ update failed: ${err.message?.slice(0, 200)}`);
  }
  let after = "";
  try { after = execSync("oracle --version", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim(); } catch {}
  console.log(`\n  ✅ done`);
  if (after) console.log(`  to:   ${after}\n`);
  else console.log("");
} else {
  // Load command plugins (beta)
  await scanCommands(join(__dirname, "commands", "plugins"), "builtin");
  await scanCommands(join(homedir(), ".oracle", "commands"), "user");

  if (!cmd || cmd === "--help" || cmd === "-h") {
    usage();
  } else {
    const handled =
      await routeComm(cmd, args) ||
      await routeTeam(cmd, args) ||
      await routeAgent(cmd, args) ||
      await routeFleet(cmd, args) ||
      await routeWorkspace(cmd, args) ||
      await routeTools(cmd, args) ||
      await routeTasks(cmd, args) ||
      await routeSpawn(cmd, args) ||
      await routeCron(cmd, args) ||
      await routeAgentsStatus(cmd, args) ||
      await routeWorktreeOps(cmd, args) ||
      await routeMergeTeam(cmd, args) ||
      await routeWakeup(cmd, args) ||
      await routeOverview(cmd, args);

    if (!handled) {
      // Try plugin commands (beta)
      const pluginMatch = matchCommand(args);
      if (pluginMatch) {
        await executeCommand(pluginMatch.desc, pluginMatch.remaining);
      } else {
        // Default: agent name shorthand (oracle <agent> <msg> or oracle <agent>)
        if (args.length >= 2) {
          const f = args.includes("--force");
          const m = args.slice(1).filter(a => a !== "--force");
          await cmdSend(args[0], m.join(" "), f);
        } else {
          await cmdPeek(args[0]);
        }
      }
    }
  }
}
