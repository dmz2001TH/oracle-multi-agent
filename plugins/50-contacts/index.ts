import type { InvokeContext, InvokeResult } from "../../src/plugins/types.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export default async function handler(ctx: InvokeContext): Promise<InvokeResult> {
  const contactFile = join(homedir(), ".oracle", "contacts.json");
  let contacts: any[] = [];
  try {
    if (existsSync(contactFile)) contacts = JSON.parse(readFileSync(contactFile, "utf-8"));
  } catch {}

  if (contacts.length === 0) {
    return { ok: true, output: "👥 No contacts yet.\nUse /contacts add <name> <role> to add." };
  }

  return {
    ok: true,
    output: `👥 Contacts (${contacts.length}):\n${contacts.map((c, i) => `${i + 1}. ${c.name} (${c.role})`).join("\n")}`,
    data: { contacts },
  };
}
