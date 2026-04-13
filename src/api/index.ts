/**
 * API router — Hono-based REST endpoints (adapted from Elysia)
 */

import { Hono } from "hono";
import { sessionsApi } from "./sessions.js";
import { feedApi } from "./feed.js";
import { teamsApi } from "./teams.js";
import { configApi } from "./config.js";
import { fleetApi } from "./fleet.js";
import { costsApi } from "./costs.js";
import { federationApi } from "./federation.js";
import { worktreesApi } from "./worktrees.js";
import { triggersApi } from "./triggers.js";
import { oracleApi } from "./oracle.js";
import { transportApi } from "./transport.js";
import { logsApi } from "./logs.js";
import { pulseApi } from "./pulse.js";
import { avengersApi } from "./avengers.js";
import { asksApi } from "./asks.js";
import { peerExecApi } from "./peer-exec.js";
import { proxyApi } from "./proxy.js";
import { uiStateApi } from "./ui-state.js";
import { tasksApi } from "./tasks.js";
import { inboxApi } from "./inbox-api.js";
import { workspaceApi } from "./workspace.js";
import { cronApi } from "./cron.js";
import { agentsApi } from "./agents.js";
import { wakeupApi } from "./wakeup.js";

export const api = new Hono();

api.route("/", sessionsApi);
api.route("/", feedApi);
api.route("/", teamsApi);
api.route("/", configApi);
api.route("/", fleetApi);
api.route("/", costsApi);
api.route("/", federationApi);
api.route("/", worktreesApi);
api.route("/", triggersApi);
api.route("/", oracleApi);
api.route("/", transportApi);
api.route("/", logsApi);
api.route("/", pulseApi);
api.route("/", avengersApi);
api.route("/", asksApi);
api.route("/", peerExecApi);
api.route("/", proxyApi);
api.route("/", uiStateApi);
api.route("/", workspaceApi);
api.route("/", tasksApi);
api.route("/", inboxApi);
api.route("/", cronApi);
api.route("/", agentsApi);
api.route("/", wakeupApi);
