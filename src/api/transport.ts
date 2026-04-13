import { Hono } from "hono";
import { getTransportRouter, resetTransportRouter, createTransportRouter } from "../transports/index.js";

export const transportApi = new Hono();

transportApi.get("/api/transport", (c) => c.json({ transports: getTransportRouter().status() }));
transportApi.post("/api/transport/reset", (c) => { resetTransportRouter(); createTransportRouter(); return c.json({ ok: true }); });
