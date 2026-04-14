/**
 * LLM Client — Direct API calls to MiMo/Gemini for orchestrator use.
 * Used by executeTask() to get real LLM responses instead of simulation.
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

/**
 * Call MiMo / OpenAI-compatible chat completions API
 */
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

/**
 * Call Gemini API
 */
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

/**
 * Unified LLM call — routes to correct provider
 */
export async function callLLM(config: LLMConfig, systemPrompt: string, userMessage: string): Promise<LLMResponse> {
  if (config.provider === "gemini") {
    return callGemini(config, systemPrompt, userMessage);
  }
  return callMiMo(config, systemPrompt, userMessage);
}

/**
 * Parse LLM response to determine task success.
 * Looks for explicit markers in the response.
 */
export function parseTaskResult(llmText: string): {
  success: boolean;
  result: string;
  reasoning: string;
} {
  const text = llmText.trim();

  // Look for explicit STATUS marker
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

  // Fallback heuristics
  const lowerText = text.toLowerCase();
  const failPatterns = ["cannot", "unable to", "failed to", "error:", "ไม่สามารถ", "ผิดพลาด", "ทำได้ไม่สำเร็จ"];
  const successPatterns = ["completed", "done", "finished", "สำเร็จ", "เรียบร้อย", "เสร็จแล้ว", "ผลลัพธ์"];

  const hasFailSignal = failPatterns.some(p => lowerText.includes(p));
  const hasSuccessSignal = successPatterns.some(p => lowerText.includes(p));

  if (hasFailSignal && !hasSuccessSignal) {
    return { success: false, result: text, reasoning: "LLM indicated failure" };
  }

  // Default: if response is substantive (>20 chars), treat as success
  const success = text.length > 20;
  return { success, result: text, reasoning: success ? "Substantive response received" : "Response too short, likely incomplete" };
}

/**
 * Build the task execution prompt with context
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
