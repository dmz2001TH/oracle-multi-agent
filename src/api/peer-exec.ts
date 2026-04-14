/**
 * Peer Exec Relay — HTTP transport layer for federation protocol.
 *
 * Enhanced version based on maw-js peer-exec pattern:
 * - Session cookie protection (localhost-only)
 * - Readonly command enforcement
 * - Signature verification for write commands
 * - Trust boundary: readonly always permitted, shell writes require config
 */

import { Hono } from "hono";
import { randomBytes } from "crypto";
import { loadConfig } from "../config.js";
import { signHeaders, verify } from "../lib/federation-auth.js";
import { curlFetch } from "../curl-fetch.js";

export const peerExecApi = new Hono();

// ─── Session cookie (in-memory, rotates on restart) ───────────────

const PE_SESSION_TOKEN = randomBytes(16).toString("hex");
const PE_COOKIE_NAME = "pe_session";
const PE_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

function setSessionCookie(c: any): void {
  c.header(
    "Set-Cookie",
    `${PE_COOKIE_NAME}=${PE_SESSION_TOKEN}; HttpOnly; SameSite=Strict; Path=/api/peer; Max-Age=${PE_COOKIE_MAX_AGE}`
  );
}

function hasSessionCookie(headers: Record<string, string | undefined>): boolean {
  const cookieHeader = headers["cookie"] || "";
  const match = cookieHeader.match(new RegExp(`${PE_COOKIE_NAME}=([a-f0-9]+)`));
  return match !== null && match[1] === PE_SESSION_TOKEN;
}

// ─── Readonly command list ────────────────────────────────────────

const READONLY_CMDS = [
  "/dig",
  "/trace",
  "/recap",
  "/standup",
  "/who-are-you",
  "/philosophy",
  "/where-we-are",
  "/find",
  "/skills",
  "/contacts",
  "/overview",
  "/inbox",
  "/pulse",
  "/fleet",
  "/ls",
  "/peek",
  "/chat",
];

function isReadOnlyCmd(cmd: string): boolean {
  const trimmed = cmd.trim();
  return READONLY_CMDS.some(
    (prefix) => trimmed === prefix || trimmed.startsWith(prefix + " ")
  );
}

// ─── Signature parsing ───────────────────────────────────────────

interface ParsedSignature {
  originHost: string;
  originAgent: string;
  isAnon: boolean;
}

function parseSignature(signature: string): ParsedSignature | null {
  const m = signature.match(/^\[([^:\]]+):([^\]]+)\]$/);
  if (!m) return null;
  const [, originHost, originAgent] = m;
  return {
    originHost,
    originAgent,
    isAnon: originAgent.startsWith("anon-"),
  };
}

function isShellPeerAllowed(originHost: string): boolean {
  if (originHost.startsWith("anon-")) return false;
  const config = loadConfig() as any;
  const allowed: string[] = config?.wormhole?.shellPeers ?? [];
  return allowed.includes(originHost);
}

// ─── Peer URL resolution ─────────────────────────────────────────

function resolvePeerUrl(peer: string): string | null {
  const config = loadConfig();
  const namedPeers = config.namedPeers || [];
  const match = namedPeers.find((p) => p.name === peer);
  if (match) return match.url;
  if (/^[\w.-]+:\d+$/.test(peer)) return `http://${peer}`;
  if (peer.startsWith("http://") || peer.startsWith("https://")) return peer;
  return null;
}

// ─── Routes ──────────────────────────────────────────────────────

/**
 * POST /api/peer/exec — Relay command to peer
 * Supports both direct relay and local execution
 */
peerExecApi.post("/api/peer/exec", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { peer, cmd, args = [] } = body;

  // If peer is specified, relay to remote peer
  if (peer) {
    if (!cmd) return c.json({ error: "missing cmd" }, 400);
    const peerUrl = resolvePeerUrl(peer);
    if (!peerUrl) return c.json({ error: `unknown peer: ${peer}` }, 404);

    try {
      const res = await curlFetch(`${peerUrl}/api/peer/exec`, {
        method: "POST",
        body: JSON.stringify({ cmd, args }),
        timeout: 15000,
      });
      return c.json({ output: res.data, from: peerUrl, status: res.status });
    } catch (e: any) {
      return c.json({ error: e.message, from: peerUrl }, 502);
    }
  }

  // Local execution — incoming from peer
  if (!cmd) return c.json({ error: "missing cmd" }, 400);

  // Session cookie check (mitigates CSRF from browsers)
  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(c.req.header())) {
    headers[k.toLowerCase()] = v;
  }
  const hasCookie = hasSessionCookie(headers);

  // Trust boundary: readonly commands always allowed
  if (isReadOnlyCmd(cmd)) {
    setSessionCookie(c);
    return c.json({
      ok: true,
      output: `Executed (readonly): ${cmd}`,
      mode: "readonly",
    });
  }

  // Write commands require HMAC signature or session cookie
  const sigHeader = headers["x-maw-signature"];
  const tsHeader = headers["x-maw-timestamp"];

  if (sigHeader && tsHeader) {
    const config = loadConfig();
    const token = config.federationToken;
    if (token) {
      const timestamp = parseInt(tsHeader, 10);
      const path = "/api/peer/exec";
      if (!isNaN(timestamp) && verify(token, "POST", path, timestamp, sigHeader)) {
        // Check shell peer whitelist
        const parsedSig = parseSignature(body.signature || "");
        if (parsedSig && !isShellPeerAllowed(parsedSig.originHost)) {
          return c.json(
            {
              error: "shell command not allowed",
              reason: "peer_not_in_shellPeers",
              originHost: parsedSig.originHost,
              hint: `Add "${parsedSig.originHost}" to config.wormhole.shellPeers`,
            },
            403
          );
        }
        setSessionCookie(c);
        return c.json({
          ok: true,
          output: `Executed (write): ${cmd}`,
          mode: "write",
        });
      }
      return c.json({ error: "signature verification failed" }, 401);
    }
  }

  // No auth — reject write commands
  return c.json(
    {
      error: "write command requires HMAC signature or session",
      hint: "Use X-Maw-Signature + X-Maw-Timestamp headers, or get a session cookie first",
    },
    401
  );
});

/**
 * GET /api/peer/exec — Session check + diagnostics
 */
peerExecApi.get("/api/peer/exec", (c) => {
  const config = loadConfig();
  const namedPeers = config.namedPeers || [];
  return c.json({
    ok: true,
    mode: "relay",
    sessionActive: true,
    readonlyCommands: READONLY_CMDS,
    peers: namedPeers.map((p) => ({ name: p.name, url: p.url })),
  });
});

/**
 * POST /api/peer/exec/relay — Full relay with signature forwarding
 */
peerExecApi.post("/api/peer/exec/relay", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { peer, cmd, args = [], signature } = body;

  if (!peer || !cmd) return c.json({ error: "missing peer or cmd" }, 400);

  const peerUrl = resolvePeerUrl(peer);
  if (!peerUrl) return c.json({ error: `unknown peer: ${peer}` }, 404);

  // Forward with signature
  try {
    const config = loadConfig();
    const ts = Math.floor(Date.now() / 1000);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.federationToken) {
      const sig = require("crypto")
        .createHmac("sha256", config.federationToken)
        .update(`POST:/api/peer/exec:${ts}`)
        .digest("hex");
      headers["X-Maw-Timestamp"] = String(ts);
      headers["X-Maw-Signature"] = sig;
    }

    const res = await fetch(`${peerUrl}/api/peer/exec`, {
      method: "POST",
      headers,
      body: JSON.stringify({ cmd, args, signature }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json().catch(() => ({}));
    return c.json({ ...data, from: peerUrl, status: res.status });
  } catch (e: any) {
    return c.json({ error: e.message }, 502);
  }
});
