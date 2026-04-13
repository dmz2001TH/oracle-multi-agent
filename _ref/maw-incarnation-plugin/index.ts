/**
 * My Plugin — template for maw-js plugins.
 *
 * One handler. Three surfaces. Edit this file.
 */
import { definePlugin } from "maw/sdk";

export default definePlugin({
  name: "my-plugin",

  // The handler — one function, all surfaces
  async handler(ctx) {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...a: any[]) => logs.push(a.map(String).join(" "));

    try {
      if (ctx.source === "cli") {
        const args = ctx.args as string[];
        console.log(`Hello from my-plugin! Args: ${args.join(", ") || "(none)"}`);
      }
      else if (ctx.source === "api") {
        console.log(JSON.stringify({ plugin: "my-plugin", received: ctx.args }));
      }
      else if (ctx.source === "peer") {
        const body = ctx.args as Record<string, unknown>;
        console.log(`Hello from peer! Message: ${body.message ?? "(none)"}`);
      }

      return { ok: true, output: logs.join("\n") || undefined };
    } catch (e: any) {
      return { ok: false, error: logs.join("\n") || e.message };
    } finally {
      console.log = origLog;
    }
  },

  // Optional hooks — uncomment what you need:
  // onGate(event) { return true; },        // return false to cancel
  // onFilter(event) { return event; },     // modify event
  // onEvent(event) { console.log(event); }, // observe
  // onLate(event) { /* cleanup */ },        // guaranteed
});
