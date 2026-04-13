import { cmdLoopEnable, cmdLoopDisable, cmdLoopHistory } from "../commands/loops-cmd.js";

export async function routeLoops(cmd: string, args: string[]): Promise<boolean> {
  if (cmd !== "loop") return false;
  const sub = args[1]?.toLowerCase();
  if (sub === "enable") await cmdLoopEnable(args.slice(2));
  else if (sub === "disable") await cmdLoopDisable(args.slice(2));
  else if (sub === "history" || sub === "hist") await cmdLoopHistory(args.slice(2));
  else { console.error(`unknown loop subcommand: ${sub}`); process.exit(1); }
  return true;
}
