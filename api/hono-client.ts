/**
 * Hono System Client
 * From MAW Guide + Hono API integration
 * 
 * Provides functions to call Hono System APIs from Oracle Dashboard
 */

const HONO_BASE_URL = process.env.HONO_BASE_URL || 'http://localhost:3456';
const TIMEOUT_MS = 5000;

/**
 * Search memory in Hono System
 */
export async function searchMemory(query: string): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${HONO_BASE_URL}/api/v2/memory/search?q=${encodeURIComponent(query)}`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Hono API error: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`[HonoClient] searchMemory failed:`, error.message);
    // Fallback: return empty results
    return { results: [], total: 0 };
  }
}

/**
 * Get agents from Hono System
 */
export async function getAgents(): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${HONO_BASE_URL}/api/v2/agents`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Hono API error: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`[HonoClient] getAgents failed:`, error.message);
    // Fallback: return empty agent list
    return { agents: [], total: 0 };
  }
}

/**
 * Post message to Hono System
 */
export async function postMessage(data: any): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${HONO_BASE_URL}/api/v2/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Hono API error: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`[HonoClient] postMessage failed:`, error.message);
    // Fallback: return error response
    return { error: 'Hono system unavailable' };
  }
}
