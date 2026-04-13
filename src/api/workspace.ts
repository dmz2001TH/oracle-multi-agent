import { Hono } from "hono";
import { loadWorkspaceConfigs } from "../transports/hub.js";

export const workspaceApi = new Hono();

workspaceApi.get("/api/workspace", (c) => c.json({ workspaces: loadWorkspaceConfigs() }));
