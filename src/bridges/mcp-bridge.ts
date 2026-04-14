/**
 * MCP Bridge — Expose oracle-multi-agent tools via Model Context Protocol
 *
 * Based on: arra-oracle-v2 MCP server pattern
 * Allows Claude Code, Cursor, and other MCP clients to use oracle tools.
 *
 * Usage:
 *   POST /api/mcp — JSON-RPC 2.0 endpoint
 *   GET  /api/mcp/tools — List available MCP tools
 *
 * For stdio MCP mode, run:
 *   node dist/bridges/mcp-bridge.js
 */

import { Hono } from "hono";
import { loadConfig } from "../config.js";
import { curlFetch } from "../curl-fetch.js";

export const mcpBridgeApi = new Hono();

// ═══════════════════════════════════════════════════════════════
// MCP Tool Definitions
// ═══════════════════════════════════════════════════════════════

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

const TOOLS: MCPTool[] = [
  {
    name: "oracle_search",
    description: "Search the Oracle knowledge base (hybrid FTS5 + semantic search)",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results (default 10)", default: 10 },
        mode: { type: "string", enum: ["hybrid", "fts", "semantic"], default: "hybrid" },
      },
      required: ["query"],
    },
  },
  {
    name: "oracle_learn",
    description: "Add new knowledge/pattern to the Oracle knowledge base",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "The knowledge content" },
        type: { type: "string", description: "Document type (pattern, learning, note)" },
        concepts: { type: "array", items: { type: "string" }, description: "Concept tags" },
      },
      required: ["content"],
    },
  },
  {
    name: "oracle_reflect",
    description: "Get random wisdom/principle from the Oracle philosophy",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "oracle_trace",
    description: "Create a trace to track decisions, actions, and results",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to trace" },
        queryType: { type: "string", description: "Trace type (decision, action, result, general)" },
        parentTraceId: { type: "string", description: "Parent trace ID for chaining" },
      },
      required: ["query"],
    },
  },
  {
    name: "oracle_trace_link",
    description: "Link two traces together (chain traces)",
    inputSchema: {
      type: "object",
      properties: {
        traceId: { type: "string", description: "Source trace ID" },
        targetTraceId: { type: "string", description: "Target trace ID to link" },
        relation: { type: "string", enum: ["child", "next", "related"], default: "related" },
      },
      required: ["traceId", "targetTraceId"],
    },
  },
  {
    name: "oracle_handoff",
    description: "Create a session handoff to transfer context to another agent",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Handoff summary" },
        fromAgent: { type: "string", description: "Source agent" },
        toAgent: { type: "string", description: "Target agent" },
      },
      required: ["summary"],
    },
  },
  {
    name: "oracle_inbox",
    description: "Read or write to the Oracle inbox",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["read", "write"], default: "read" },
        message: { type: "string", description: "Message to write (for write action)" },
        from: { type: "string", description: "Sender name" },
      },
    },
  },
  {
    name: "oracle_stats",
    description: "Get Oracle system statistics (memory, traces, documents)",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "oracle_agents",
    description: "List all running agents and their status",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "oracle_federation_status",
    description: "Get federation mesh status (all connected nodes)",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "oracle_command",
    description: "Execute an oracle CLI command",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Command to execute (e.g., /help, /recap, /standup)" },
      },
      required: ["command"],
    },
  },
  {
    name: "oracle_schedule",
    description: "Query or create scheduled tasks",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "add"], default: "list" },
        task: { type: "string", description: "Task description (for add action)" },
        cron: { type: "string", description: "Cron expression (for add action)" },
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// Tool Handlers
// ═══════════════════════════════════════════════════════════════

async function handleToolCall(
  name: string,
  args: Record<string, any>
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const config = loadConfig();
  const base = `http://localhost:${config.port}`;

  try {
    switch (name) {
      case "oracle_search": {
        const qs = new URLSearchParams({
          q: args.query,
          limit: String(args.limit || 10),
          mode: args.mode || "hybrid",
        });
        const res = await curlFetch(`${base}/api/v2/memory/search?${qs}`, { timeout: 10000 });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "oracle_learn": {
        const res = await curlFetch(`${base}/api/oracle-v2/learn`, {
          method: "POST",
          body: JSON.stringify({
            content: args.content,
            type: args.type || "learning",
            concepts: args.concepts || [],
          }),
          timeout: 10000,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "oracle_reflect": {
        const res = await curlFetch(`${base}/api/oracle-v2/reflect`, { timeout: 5000 });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "oracle_trace": {
        const res = await curlFetch(`${base}/api/oracle-v2/trace`, {
          method: "POST",
          body: JSON.stringify({
            query: args.query,
            queryType: args.queryType || "general",
            parentTraceId: args.parentTraceId,
          }),
          timeout: 10000,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "oracle_trace_link": {
        const res = await curlFetch(`${base}/api/oracle-v2/trace/${args.traceId}/link`, {
          method: "POST",
          body: JSON.stringify({
            targetTraceId: args.targetTraceId,
            relation: args.relation || "related",
          }),
          timeout: 10000,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "oracle_handoff": {
        const res = await curlFetch(`${base}/api/oracle-v2/handoff`, {
          method: "POST",
          body: JSON.stringify(args),
          timeout: 10000,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "oracle_inbox": {
        if (args.action === "write") {
          const res = await curlFetch(`${base}/api/oracle-v2/inbox`, {
            method: "POST",
            body: JSON.stringify({ message: args.message, from: args.from }),
            timeout: 10000,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
          };
        }
        const res = await curlFetch(`${base}/api/oracle-v2/inbox`, { timeout: 5000 });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "oracle_stats": {
        const [memRes, vaultRes] = await Promise.all([
          curlFetch(`${base}/api/v2/memory/stats`, { timeout: 5000 }),
          curlFetch(`${base}/api/vault/stats`, { timeout: 5000 }),
        ]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { memory: memRes.data, vault: vaultRes.data },
                null,
                2
              ),
            },
          ],
        };
      }

      case "oracle_agents": {
        const res = await curlFetch(`${base}/api/v2/agents`, { timeout: 5000 });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "oracle_federation_status": {
        const res = await curlFetch(`${base}/api/federation/status`, { timeout: 5000 });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "oracle_command": {
        const res = await curlFetch(`${base}/api/commands/execute`, {
          method: "POST",
          body: JSON.stringify({ input: args.command }),
          timeout: 15000,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      case "oracle_schedule": {
        if (args.action === "add") {
          const res = await curlFetch(`${base}/api/oracle-v2/schedule`, {
            method: "POST",
            body: JSON.stringify({ task: args.task, cron: args.cron }),
            timeout: 10000,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
          };
        }
        const res = await curlFetch(`${base}/api/oracle-v2/schedule`, { timeout: 5000 });
        return {
          content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
        };
    }
  } catch (e: any) {
    return {
      content: [{ type: "text", text: `Error: ${e.message}` }],
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// JSON-RPC 2.0 Handler
// ═══════════════════════════════════════════════════════════════

async function handleMCPRequest(body: any): Promise<any> {
  const { jsonrpc, id, method, params } = body;

  if (jsonrpc !== "2.0") {
    return { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid JSON-RPC version" } };
  }

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "oracle-multi-agent", version: "5.0.0" },
          capabilities: { tools: {} },
        },
      };

    case "notifications/initialized":
      return null; // No response needed for notifications

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: TOOLS },
      };

    case "tools/call": {
      const { name, arguments: args } = params || {};
      if (!name) {
        return { jsonrpc: "2.0", id, error: { code: -32602, message: "Missing tool name" } };
      }
      const result = await handleToolCall(name, args || {});
      return { jsonrpc: "2.0", id, result };
    }

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

// ═══════════════════════════════════════════════════════════════
// HTTP Routes
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/mcp — JSON-RPC 2.0 MCP endpoint
 */
mcpBridgeApi.post("/api/mcp", async (c) => {
  try {
    const body = await c.req.json();
    const result = await handleMCPRequest(body);
    if (result === null) return c.json({ ok: true }); // notification
    return c.json(result);
  } catch (e: any) {
    return c.json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  }
});

/**
 * GET /api/mcp/tools — List MCP tools (human-readable)
 */
mcpBridgeApi.get("/api/mcp/tools", (c) => {
  return c.json({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
    })),
    total: TOOLS.length,
    protocol: "MCP 2024-11-05",
    endpoint: "/api/mcp",
  });
});

/**
 * GET /api/mcp/status — MCP bridge status
 */
mcpBridgeApi.get("/api/mcp/status", (c) => {
  return c.json({
    ok: true,
    name: "oracle-multi-agent",
    version: "5.0.0",
    protocol: "2024-11-05",
    tools: TOOLS.length,
    transport: "http",
  });
});
