/**
 * Built-in: Shell hooks — fire configured shell scripts on feed events.
 */
import type { MawHooks } from "../../plugins.js";

export default function(hooks: MawHooks) {
  // Lazy-load hooks module (ESM dynamic import)
  let runHookPromise: Promise<any> | null = null;
  const getRunHook = () => {
    if (!runHookPromise) runHookPromise = import("../../hooks.js").then(m => m.runHook).catch(() => null);
    return runHookPromise;
  };

  hooks.on("*", async (event: any) => {
    const runHook = await getRunHook();
    if (!runHook) return;
    runHook(event.event, {
      from: event.oracle,
      to: event.oracle,
      message: event.message,
      channel: "feed",
    }).catch((err: Error) => {
      console.error("[hooks]", event.event, err.message);
    });
  });
}
