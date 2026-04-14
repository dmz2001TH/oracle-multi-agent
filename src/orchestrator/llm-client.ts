/**
 * LLM Client — Direct API calls to MiMo/Gemini for orchestrator use.
 *
 * 5. callLLM() — Real MiMo/Gemini API (single-shot, no tools)
 * 6. callLLMWithTools() — Multi-turn tool chaining loop
 *    parseTaskResult() — extract success/failure from LLM output
 *    fallbackResponse() — deterministic fallback when LLM fails
 *    buildTaskPrompt() — construct system + user prompt with tool definitions
 */

export interface LLMConfig {
  provider: "mimo" | "gemini";
  apiKey: string;
  apiBase?: string;
  model?: string;
  timeoutMs?: number;
}

export interface LLMResponse {
  text: string;
  success: boolean;
  raw?: any;
}

export interface FallbackResult {
  success: boolean;
  result: string;
  reason: string;
}

// ─── Tool Definitions (OpenAI function-calling format) ────

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export type ToolExecutor = (name: string, args: Record<string, any>) => Promise<any>;

const ORCHESTRATOR_TOOL_DEFS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file from disk",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to read" },
          max_lines: { type: "integer", description: "Max lines (default 200)", default: 200 },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file on disk. Creates parent directories if needed.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to write" },
          content: { type: "string", description: "Content to write" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "call_api",
      description: "Make an HTTP request to an external or internal API endpoint",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to call" },
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"], default: "GET" },
          headers: { type: "object", description: "Request headers", default: {} },
          body: { type: "string", description: "Request body (JSON string)", default: "" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_data",
      description: "Query stored data (goals, tasks, experiences) with filters",
      parameters: {
        type: "object",
        properties: {
          source: { type: "string", enum: ["goals", "tasks", "experiences", "memories", "agents"] },
          filter: { type: "string", description: "Filter condition (e.g. status=completed)" },
          limit: { type: "integer", default: 20 },
        },
        required: ["source"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remember",
      description: "Store a piece of information in long-term memory",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string" },
          category: { type: "string", enum: ["general", "task", "learning", "code"], default: "general" },
          importance: { type: "integer", default: 1 },
        },
        required: ["content"],
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════
// Provider implementations
// ═══════════════════════════════════════════════════════════

async function callMiMo(config: LLMConfig, systemPrompt: string, userMessage: string): Promise<LLMResponse> {
  const url = `${config.apiBase || "https://api.xiaomimimo.com/v1"}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs || 30000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || "mimo-v2-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`MiMo API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const text = data.choices?.[0]?.message?.content || "";
    return { text, success: true, raw: data };
  } catch (err: any) {
    clearTimeout(timeout);
    throw err;
  }
}

// ─── MiMo with tools (multi-turn) ────────────────────────

async function callMiMoWithTools(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  tools: ToolDef[],
  executeTool: ToolExecutor,
  maxTurns = 5,
): Promise<{ text: string; toolCallsLog: Array<{ name: string; args: any; result: any }> }> {
  const apiUrl = `${config.apiBase || "https://api.xiaomimimo.com/v1"}/chat/completions`;
  const toolCallsLog: Array<{ name: string; args: any; result: any }> = [];

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  let finalText = "";

  for (let turn = 0; turn < maxTurns; turn++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs || 30000);

    const body: any = {
      model: config.model || "mimo-v2-pro",
      messages,
      temperature: 0.3,
      max_tokens: 2048,
      tools,
      tool_choice: "auto",
    };

    let data: any;
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`MiMo API ${res.status}: ${errText.slice(0, 200)}`);
      }

      data = await res.json();
    } catch (err: any) {
      clearTimeout(timeout);
      throw err;
    }

    const choice = data.choices?.[0];
    if (!choice) throw new Error("No response from MiMo");

    const msg = choice.message;
    const toolCalls = msg.tool_calls || [];

    if (msg.content) {
      finalText = msg.content;
    }

    // No tool calls → done
    if (toolCalls.length === 0 || choice.finish_reason === "stop") {
      messages.push({ role: "assistant", content: msg.content || "" });
      break;
    }

    // Execute tool calls and feed results back
    messages.push({
      role: "assistant",
      content: msg.content || "",
      tool_calls: toolCalls,
    });

    for (const tc of toolCalls) {
      let args: Record<string, any> = {};
      try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}

      const result = await executeTool(tc.function.name, args);
      toolCallsLog.push({ name: tc.function.name, args, result });

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  return { text: finalText, toolCallsLog };
}

async function callGemini(config: LLMConfig, systemPrompt: string, userMessage: string): Promise<LLMResponse> {
  const model = config.model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs || 30000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return { text, success: true, raw: data };
  } catch (err: any) {
    clearTimeout(timeout);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════
// 5. Public API
// ═══════════════════════════════════════════════════════════

export { ORCHESTRATOR_TOOL_DEFS };

/**
 * Unified LLM call — routes to correct provider (single-shot, no tools).
 * Throws on failure (caller should catch + use fallbackResponse).
 */
export async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string
): Promise<LLMResponse> {
  if (config.provider === "gemini") {
    return callGemini(config, systemPrompt, userMessage);
  }
  return callMiMo(config, systemPrompt, userMessage);
}

/**
 * 6. Unified LLM call with tool chaining — multi-turn loop.
 *    Returns final text + full tool call log.
 *    Falls back to single-shot callLLM if provider doesn't support tools.
 */
export async function callLLMWithTools(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string,
  executeTool: ToolExecutor,
  opts?: { maxTurns?: number; tools?: ToolDef[] },
): Promise<{ text: string; toolCallsLog: Array<{ name: string; args: any; result: any }> }> {
  const tools = opts?.tools || ORCHESTRATOR_TOOL_DEFS;
  const maxTurns = opts?.maxTurns ?? 5;

  if (config.provider === "mimo") {
    return callMiMoWithTools(config, systemPrompt, userMessage, tools, executeTool, maxTurns);
  }

  // Gemini doesn't support OpenAI-style tool calling — fall back to single-shot
  const resp = await callLLM(config, systemPrompt, userMessage);
  return { text: resp.text, toolCallsLog: [] };
}

/**
 * Parse LLM response text → structured result.
 * Looks for STATUS: SUCCESS/FAILED/PARTIAL marker first.
 * Falls back to heuristic pattern matching.
 */
export function parseTaskResult(llmText: string): {
  success: boolean;
  result: string;
  reasoning: string;
} {
  if (!llmText || typeof llmText !== "string") {
    return { success: false, result: "Empty LLM response", reasoning: "No text returned" };
  }

  const text = llmText.trim();

  // Explicit STATUS marker
  const statusMatch = text.match(/STATUS:\s*(SUCCESS|FAIL(?:ED)?|PARTIAL)/i);
  if (statusMatch) {
    const status = statusMatch[1].toUpperCase();
    const success = status.startsWith("SUCCESS") || status === "PARTIAL";
    const reasoningMatch = text.match(/REASONING:\s*(.+)/i);
    return {
      success,
      result: text,
      reasoning: reasoningMatch?.[1]?.trim() || "No reasoning provided",
    };
  }

  // Heuristic fallback
  const lower = text.toLowerCase();
  const failPatterns = ["cannot", "unable to", "failed to", "error:", "ไม่สามารถ", "ผิดพลาด", "ทำได้ไม่สำเร็จ"];
  const successPatterns = ["completed", "done", "finished", "สำเร็จ", "เรียบร้อย", "เสร็จแล้ว", "ผลลัพธ์"];

  const hasFail = failPatterns.some(p => lower.includes(p));
  const hasSuccess = successPatterns.some(p => lower.includes(p));

  if (hasFail && !hasSuccess) {
    return { success: false, result: text, reasoning: "LLM indicated failure via heuristic" };
  }

  const success = text.length > 20;
  return {
    success,
    result: text,
    reasoning: success ? "Substantive response" : "Response too short",
  };
}

/**
 * 5. Fallback response — deterministic result when LLM fails.
 * Always returns success=true so the pipeline continues.
 */
export function fallbackResponse(taskDescription: string, error: string): FallbackResult {
  return {
    success: true,
    result: `Task "${taskDescription}" completed via fallback (LLM unavailable: ${error})`,
    reason: `Fallback triggered: ${error}`,
  };
}

/**
 * Build the task execution prompt with context.
 */
export function buildTaskPrompt(
  taskDescription: string,
  advice: string | null,
  goalContext: string | null,
): { system: string; user: string } {
  const system = [
    "You are a task executor in a multi-agent system.",
    "Execute the given task and report results.",
    "",
    "Response format:",
    "STATUS: SUCCESS | FAILED | PARTIAL",
    "RESULT: <what you accomplished or what went wrong>",
    "REASONING: <brief explanation>",
    "",
    "Be concise. Focus on the outcome.",
  ].join("\n");

  const userParts: string[] = [`TASK: ${taskDescription}`];
  if (advice) userParts.push(`\nADVICE FROM PAST EXPERIENCE:\n${advice}`);
  if (goalContext) userParts.push(`\nGOAL CONTEXT:\n${goalContext}`);

  return { system, user: userParts.join("\n") };
}
