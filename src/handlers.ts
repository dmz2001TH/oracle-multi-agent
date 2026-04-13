import { sendKeys, selectWindow, hostExec } from "./ssh.js";
import { tmux } from "./tmux.js";
import { buildCommand } from "./config.js";
import type { MawWS, Handler, MawEngineLike } from "./types.js";

async function runAction(ws: MawWS, action: string, target: string, fn: () => Promise<void>) {
  try { await fn(); ws.send(JSON.stringify({ type: "action-ok", action, target })); }
  catch (e: any) { ws.send(JSON.stringify({ type: "error", error: e.message })); }
}

const subscribe: Handler = (ws, data, engine) => {
  ws.data.target = data.target;
  (engine as any).pushCapture?.(ws);
};

const select: Handler = (_ws, data) => {
  selectWindow(data.target).catch(() => {});
};

const send: Handler = async (ws, data, engine) => {
  sendKeys(data.target, data.text)
    .then(() => { ws.send(JSON.stringify({ type: "sent", ok: true, target: data.target })); })
    .catch((e: any) => ws.send(JSON.stringify({ type: "error", error: e.message })));
};

const sleep: Handler = (ws, data) => runAction(ws, "sleep", data.target, () => sendKeys(data.target, "\x03"));
const stop: Handler = (ws, data) => runAction(ws, "stop", data.target, () => tmux.killWindow(data.target));

const wake: Handler = (ws, data) => {
  const cmd = data.command || buildCommand(data.target?.split(":").pop() || "");
  runAction(ws, "wake", data.target, () => sendKeys(data.target, cmd + "\r"));
};

const restart: Handler = (ws, data) => {
  const cmd = data.command || buildCommand(data.target?.split(":").pop() || "");
  runAction(ws, "restart", data.target, async () => {
    await sendKeys(data.target, "\x03");
    await new Promise(r => setTimeout(r, 2000));
    await sendKeys(data.target, "\x03");
    await new Promise(r => setTimeout(r, 500));
    await sendKeys(data.target, cmd + "\r");
  });
};

export function registerBuiltinHandlers(engine: MawEngineLike) {
  engine.on("subscribe", subscribe);
  engine.on("select", select);
  engine.on("send", send);
  engine.on("sleep", sleep);
  engine.on("stop", stop);
  engine.on("wake", wake);
  engine.on("restart", restart);
}
