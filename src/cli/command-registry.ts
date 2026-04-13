/**
 * Command Plugin Registry (beta) — pluggable CLI commands.
 *
 * Drop a .ts/.js file in ~/.oracle/commands/ with:
 *   export const command = { name: "hello", description: "Say hello" };
 *   export default async function(args, flags) { ... }
 *
 * Or drop a .wasm file that exports handle(ptr, len) + memory.
 * Supports subcommands: name: "fleet doctor" or ["fleet doctor", "fleet dr"]
 * Longest prefix match wins. Core routes always take priority.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseFlags } from "./parse-args.js";
import {
  buildImportObject, preCacheBridge, readString,
  textEncoder, textDecoder,
  type WasmBridge,
} from "./wasm-bridge.js";

/* ─── WASM Safety Constants ─── */
const WASM_MEMORY_MAX_PAGES = 256;
const WASM_COMMAND_TIMEOUT_MS = 5_000;

export interface CommandDescriptor {
  name: string | string[];
  description: string;
  usage?: string;
  flags?: Record<string, any>;
  patterns?: string[][];
  path?: string;
  scope?: "builtin" | "user";
}

const commands = new Map<string, { desc: CommandDescriptor; path: string }>();

const wasmInstances = new Map<string, {
  handle: (ptr: number, len: number) => number;
  memory: WebAssembly.Memory;
  instance: WebAssembly.Instance;
  bridge: WasmBridge;
}>();

export function registerCommand(desc: CommandDescriptor, path: string, scope: "builtin" | "user") {
  const names = Array.isArray(desc.name) ? desc.name : [desc.name];
  for (const n of names) {
    const key = n.toLowerCase().trim();
    if (commands.has(key)) {
      console.log(`[commands] overriding "${key}" (was: ${commands.get(key)!.desc.scope}, now: ${scope})`);
    }
    commands.set(key, { desc: { ...desc, scope, path }, path });
  }
}

export function matchCommand(args: string[]): { desc: CommandDescriptor; remaining: string[]; key: string } | null {
  let best: { desc: CommandDescriptor; remaining: string[]; key: string; len: number } | null = null;
  for (const [key, entry] of commands) {
    const parts = key.split(/\s+/);
    let match = true;
    for (let i = 0; i < parts.length; i++) {
      if (!args[i] || args[i].toLowerCase() !== parts[i]) { match = false; break; }
    }
    if (match && parts.length > (best?.len ?? 0)) {
      best = { desc: entry.desc, remaining: args.slice(parts.length), key, len: parts.length };
    }
  }
  return best;
}

async function loadWasmCommand(path: string, filename: string, scope: "builtin" | "user"): Promise<void> {
  const wasmBytes = readFileSync(path);
  const mod = new WebAssembly.Module(wasmBytes);
  const exports = WebAssembly.Module.exports(mod);
  const exportNames = exports.map((e: { name: string }) => e.name);

  if (!exportNames.includes("handle") || !exportNames.includes("memory")) {
    console.log(`[commands] skipped wasm: ${filename} (no handle+memory exports)`);
    return;
  }

  let wasmMemory: WebAssembly.Memory;
  let wasmAlloc: (size: number) => number;

  const bridge = buildImportObject(
    () => wasmMemory,
    () => wasmAlloc,
    { memoryMaxPages: WASM_MEMORY_MAX_PAGES },
  );

  let instance: WebAssembly.Instance;
  try {
    instance = new WebAssembly.Instance(mod, bridge as unknown as WebAssembly.Imports);
  } catch (err: any) {
    console.error(`[commands] wasm instantiation failed: ${filename}: ${err.message?.slice(0, 120)}`);
    return;
  }

  wasmMemory = instance.exports.memory as WebAssembly.Memory;
  wasmAlloc = (instance.exports.maw_alloc as (size: number) => number)
    ?? bridge.env.maw_alloc;

  const memoryPages = wasmMemory.buffer.byteLength / 65_536;
  if (memoryPages > WASM_MEMORY_MAX_PAGES) {
    console.error(`[commands] wasm rejected: ${filename} — initial memory (${memoryPages} pages) exceeds ${WASM_MEMORY_MAX_PAGES}-page limit`);
    return;
  }

  const handle = instance.exports.handle as (ptr: number, len: number) => number;
  const name = (instance.exports.command_name as WebAssembly.Global)?.value
    || filename.replace(/\.wasm$/, "");
  const description = (instance.exports.command_desc as WebAssembly.Global)?.value
    || `WASM command: ${filename}`;

  registerCommand({ name, description }, path, scope);
  wasmInstances.set(path, { handle, memory: wasmMemory, instance, bridge });
  console.log(`[commands] loaded wasm: ${filename} (memory: ${memoryPages}/${WASM_MEMORY_MAX_PAGES} pages)`);
}

export async function executeCommand(desc: CommandDescriptor, remaining: string[]): Promise<void> {
  if (desc.path?.endsWith(".wasm")) {
    const wasm = wasmInstances.get(desc.path!);
    if (!wasm) { console.error(`[commands] WASM instance not found: ${desc.path}`); return; }

    const wasmExec = (async () => {
      await preCacheBridge(wasm.bridge);

      if (wasm.memory.buffer.byteLength > WASM_MEMORY_MAX_PAGES * 65_536) {
        console.error(`[commands] WASM memory exceeded ${WASM_MEMORY_MAX_PAGES}-page limit — refusing to execute`);
        wasmInstances.delete(desc.path!);
        return;
      }

      const json = JSON.stringify(remaining);
      const bytes = textEncoder.encode(json);
      const argPtr = (wasm.instance.exports.maw_alloc as Function)?.(bytes.length) ?? 0;
      new Uint8Array(wasm.memory.buffer).set(bytes, argPtr);

      const resultPtr = wasm.handle(argPtr, bytes.length);

      if (resultPtr > 0) {
        const view = new DataView(wasm.memory.buffer);
        const len = view.getUint32(resultPtr, true);
        if (len > 0 && len < 1_000_000) {
          const result = readString(wasm.memory, resultPtr + 4, len);
          if (result) console.log(result);
        } else {
          const raw = new Uint8Array(wasm.memory.buffer);
          let end = resultPtr;
          while (end < raw.length && raw[end] !== 0) end++;
          const result = textDecoder.decode(raw.slice(resultPtr, end));
          if (result) console.log(result);
        }
      }
    })();

    const timeoutGuard = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[wasm-safety] timed out after ${WASM_COMMAND_TIMEOUT_MS / 1000}s`)), WASM_COMMAND_TIMEOUT_MS));

    try {
      await Promise.race([wasmExec, timeoutGuard]);
    } catch (err: any) {
      const msg = err.message || String(err);
      console.error(`[commands] WASM error in "${desc.name}": ${msg}`);
      wasmInstances.delete(desc.path!);
    }
    return;
  }

  const mod = await import(desc.path!);
  const handler = mod.default || mod.handler;
  if (!handler) { console.error(`[commands] ${desc.name}: no default export or handler`); return; }
  const flags = desc.flags ? parseFlags(["_", ...remaining], desc.flags, 1) : { _: remaining };
  await handler(flags._, flags);
}

export async function scanCommands(dir: string, scope: "builtin" | "user"): Promise<number> {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const file of readdirSync(dir).filter(f => /\.(ts|js|wasm)$/.test(f))) {
    try {
      const path = join(dir, file);
      if (file.endsWith(".wasm")) {
        await loadWasmCommand(path, file, scope);
        count++;
      } else {
        const mod = await import(path);
        if (mod.command?.name) {
          registerCommand(mod.command, path, scope);
          count++;
        }
      }
    } catch (err: any) {
      console.error(`[commands] failed to load ${file}: ${err.message?.slice(0, 80)}`);
    }
  }
  return count;
}

export function listCommands(): CommandDescriptor[] {
  const seen = new Set<string>();
  const result: CommandDescriptor[] = [];
  for (const [, entry] of commands) {
    const key = entry.path;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry.desc);
  }
  return result;
}
