import { join } from "path";
import { CONFIG_DIR } from "./paths.js";
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { tmux } from "./tmux.js";

const TAB_ORDER_DIR = join(CONFIG_DIR, "tab-order");
mkdirSync(TAB_ORDER_DIR, { recursive: true });

export interface TabOrderEntry { index: number; name: string; }

export async function saveTabOrder(session: string): Promise<void> {
  try {
    const windows = await tmux.listWindows(session);
    const order: TabOrderEntry[] = windows.sort((a, b) => a.index - b.index).map(w => ({ index: w.index, name: w.name }));
    writeFileSync(join(TAB_ORDER_DIR, `${session}.json`), JSON.stringify(order, null, 2) + "\n");
  } catch {}
}

export async function restoreTabOrder(session: string): Promise<number> {
  const filePath = join(TAB_ORDER_DIR, `${session}.json`);
  if (!existsSync(filePath)) return 0;
  let savedOrder: TabOrderEntry[];
  try { savedOrder = JSON.parse(readFileSync(filePath, "utf-8")); } catch { return 0; }
  if (!savedOrder.length) return 0;
  let moved = 0;
  for (const saved of savedOrder) {
    let currentWindows: { index: number; name: string }[];
    try { currentWindows = await tmux.listWindows(session); } catch { break; }
    const actual = currentWindows.find(w => w.name === saved.name);
    if (!actual || actual.index === saved.index) continue;
    const atTarget = currentWindows.find(w => w.index === saved.index);
    if (atTarget) {
      try { await tmux.run("swap-window", "-s", `${session}:${actual.index}`, "-t", `${session}:${saved.index}`); moved++; }
      catch { try { await tmux.run("move-window", "-s", `${session}:${actual.index}`, "-t", `${session}:${saved.index}`); moved++; } catch {} }
    } else {
      try { await tmux.run("move-window", "-s", `${session}:${actual.index}`, "-t", `${session}:${saved.index}`); moved++; } catch {}
    }
  }
  try { unlinkSync(filePath); } catch {}
  return moved;
}
