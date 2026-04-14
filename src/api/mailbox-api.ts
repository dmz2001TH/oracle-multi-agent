/**
 * Mailbox API — Tier 2 Transport endpoints
 */
import { Hono } from "hono";
import { sendMessage, readInbox, markRead, markAllRead, getMailboxStatus, getTeamStatus, broadcast, setStandingOrder, getStandingOrders, cancelStandingOrder, listTeams, listTeamAgents, archiveInbox } from "../mailbox/index.js";

export const mailboxApi = new Hono();

mailboxApi.get("/api/mailbox/teams", (c) => c.json({ ok: true, teams: listTeams() }));

mailboxApi.get("/api/mailbox/:team/status", (c) => {
  const team = c.req.param("team");
  return c.json({ ok: true, team, agents: getTeamStatus(team) });
});

mailboxApi.get("/api/mailbox/:team/:agent", (c) => {
  const { team, agent } = c.req.param() as any;
  const limit = parseInt(c.req.query("limit") || "50");
  const unreadOnly = c.req.query("unread") === "true";
  return c.json({ ok: true, messages: readInbox(team, agent, { limit, unreadOnly }) });
});

mailboxApi.post("/api/mailbox/:team/:agent/send", async (c) => {
  const { team, agent } = c.req.param() as any;
  const body = await c.req.json();
  const msg = sendMessage(team, body.from || "system", agent, body.message, { type: body.type, priority: body.priority, ref: body.ref });
  return c.json({ ok: true, message: msg });
});

mailboxApi.post("/api/mailbox/:team/:agent/read", async (c) => {
  const { team, agent } = c.req.param() as any;
  const body = await c.req.json();
  const count = body.ids ? markRead(team, agent, body.ids) : markAllRead(team, agent);
  return c.json({ ok: true, markedRead: count });
});

mailboxApi.post("/api/mailbox/:team/broadcast", async (c) => {
  const team = c.req.param("team");
  const body = await c.req.json();
  const msgs = broadcast(team, body.from || "system", body.message, { priority: body.priority });
  return c.json({ ok: true, sent: msgs.length, messages: msgs });
});

mailboxApi.post("/api/mailbox/:team/:agent/standing-order", async (c) => {
  const { team, agent } = c.req.param() as any;
  const body = await c.req.json();
  const so = setStandingOrder(team, agent, body.order, { priority: body.priority, expiresAt: body.expiresAt });
  return c.json({ ok: true, order: so });
});

mailboxApi.get("/api/mailbox/:team/:agent/standing-orders", (c) => {
  const { team, agent } = c.req.param() as any;
  return c.json({ ok: true, orders: getStandingOrders(team, agent) });
});

mailboxApi.delete("/api/mailbox/:team/:agent/standing-order/:orderId", (c) => {
  const { team, agent, orderId } = c.req.param() as any;
  return c.json({ ok: true, cancelled: cancelStandingOrder(team, agent, orderId) });
});

mailboxApi.post("/api/mailbox/:team/:agent/archive", (c) => {
  const { team, agent } = c.req.param() as any;
  return c.json({ ok: true, archiveFile: archiveInbox(team, agent) });
});

mailboxApi.get("/api/mailbox/:team/agents", (c) => {
  return c.json({ ok: true, agents: listTeamAgents(c.req.param("team")) });
});
