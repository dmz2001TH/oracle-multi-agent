import { cmdTokensShow, cmdTokensRecord, cmdTokensReset } from "../commands/tokens-cmd.js";

export async function routeTokens(cmd: string, args: string[]): Promise<boolean> {
  if (cmd !== "tokens" && cmd !== "tok") return false;
  const sub = args[1]?.toLowerCase();
  if (!sub) await cmdTokensShow();
  else if (sub === "record") await cmdTokensRecord(args.slice(2));
  else if (sub === "reset") await cmdTokensReset();
  else if (sub === "show" || sub === "ls") await cmdTokensShow();
  else { console.error(`unknown tokens subcommand: ${sub}`); process.exit(1); }
  return true;
}
