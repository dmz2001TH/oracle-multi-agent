/**
 * Built-in: MQTT publish — broadcast feed events to configurable broker.
 */
import type { MawHooks } from "../../plugins.js";
import { loadConfig } from "../../config.js";

export default function(hooks: MawHooks) {
  const config = loadConfig();
  if (!config.node) return;

  // Lazy-load mqtt module (ESM dynamic import)
  let mqttPromise: Promise<any> | null = null;
  const getMqttPublish = () => {
    if (!mqttPromise) mqttPromise = import("../../mqtt-publish.js").then(m => m.mqttPublish).catch(() => null);
    return mqttPromise;
  };

  const node = config.node;

  hooks.on("*", async (event: any) => {
    const mqttPublish = await getMqttPublish();
    if (!mqttPublish) return;
    mqttPublish(`maw/v1/oracle/${event.oracle}/feed`, event);
    mqttPublish(`maw/v1/node/${node}/feed`, event);
  });
}
