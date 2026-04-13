/**
 * Vector Store Factory — stub for oracle tools
 */

import type { VectorStoreAdapter } from './types.ts';

let _connected = false;

export async function ensureVectorStoreConnected(): Promise<VectorStoreAdapter | null> {
  // Stub — vector store not available in minimal mode
  return null;
}
