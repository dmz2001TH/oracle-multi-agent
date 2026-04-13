import { cmdMeetingCreate, cmdMeetingList, cmdMeetingShow, cmdMeetingNote, cmdMeetingDone } from "../commands/meetings-cmd.js";

export async function routeMeetings(cmd: string, args: string[]): Promise<boolean> {
  if (cmd !== "meeting" && cmd !== "meet") return false;
  const sub = args[1]?.toLowerCase();
  if (!sub || sub === "ls" || sub === "list") await cmdMeetingList();
  else if (sub === "create" || sub === "new" || sub === "add") await cmdMeetingCreate(args.slice(2));
  else if (sub === "show" || sub === "info") await cmdMeetingShow(args.slice(2));
  else if (sub === "note") await cmdMeetingNote(args.slice(2));
  else if (sub === "done" || sub === "complete") await cmdMeetingDone(args.slice(2));
  else { console.error(`unknown meeting subcommand: ${sub}`); process.exit(1); }
  return true;
}
