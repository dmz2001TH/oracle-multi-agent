import { cmdChatShow, cmdChatSend, cmdChatReply, cmdChatList } from "../commands/chat-log-cmd.js";

export async function routeChatLog(cmd: string, args: string[]): Promise<boolean> {
  if (cmd !== "chat") return false;
  const sub = args[1]?.toLowerCase();
  if (!sub) { console.error("usage: oracle chat <ls|send|reply|show>"); process.exit(1); }
  else if (sub === "ls" || sub === "list") await cmdChatList();
  else if (sub === "send") await cmdChatSend(args.slice(2));
  else if (sub === "reply") await cmdChatReply(args.slice(2));
  else if (sub === "show" || sub === "history") await cmdChatShow(args[2] || "", args[4] || "20");
  else {
    // oracle chat <oracle> — shorthand to show chat
    await cmdChatShow(sub, args[2] || "20");
  }
  return true;
}
