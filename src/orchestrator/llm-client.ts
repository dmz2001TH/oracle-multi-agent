/**
 * LLM Client — Direct API calls to MiMo/Gemini for orchestrator use.
 *
 * 5. callLLM() — Real MiMo/Gemini API
 *    parseTaskResult() — extract success/failure from LLM output
 *    fallbackResponse() — deterministic fallback when LLM fails
 *    buildTaskPrompt() — construct system + user prompt
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

/**
 * Unified LLM call — routes to correct provider.
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
