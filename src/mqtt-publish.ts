import mqtt from "mqtt";
import { loadConfig } from "./config.js";

let client: mqtt.MqttClient | null = null;

function getClient(): mqtt.MqttClient | null {
  if (client) return client;
  const config = loadConfig();
  const broker = (config as any).mqttPublish?.broker;
  if (!broker) return null;
  client = mqtt.connect(broker, {
    clientId: `oracle-${config.node ?? "local"}-${Date.now()}`,
    clean: true, reconnectPeriod: 5000,
  });
  client.on("error", () => {});
  return client;
}

export function mqttPublish(topic: string, payload: object) {
  const c = getClient();
  if (!c) return;
  c.publish(topic, JSON.stringify(payload), { qos: 0 });
}
