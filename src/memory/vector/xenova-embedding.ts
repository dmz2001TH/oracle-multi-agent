/**
 * Xenova/Transformers Embedding Provider
 *
 * Uses @xenova/transformers (ONNX runtime) for local embedding generation.
 * Supports multiple models:
 *   - Xenova/all-MiniLM-L6-v2 (default, 384-dim, fast)
 *   - Xenova/paraphrase-multilingual-MiniLM-L12-v2 (384-dim, multilingual)
 *   - BAAI/bge-small-en-v1.5 (384-dim, high quality)
 *
 * No external API needed — runs entirely locally.
 */

import type { EmbeddingProvider } from '../vector/types.ts';

let pipeline: any = null;
let extractor: any = null;

const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';

async function loadPipeline(modelName: string): Promise<any> {
  if (extractor && pipeline) return extractor;

  try {
    // Dynamic import of @xenova/transformers
    const transformers = await import('@xenova/transformers');
    pipeline = transformers.pipeline;

    console.log(`🧠 Loading embedding model: ${modelName}...`);
    extractor = await pipeline('feature-extraction', modelName, {
      quantized: true, // Use quantized model for faster inference
    });
    console.log(`✅ Embedding model loaded: ${modelName}`);
    return extractor;
  } catch (err) {
    console.error(`❌ Failed to load embedding model: ${(err as Error).message}`);
    throw err;
  }
}

/**
 * Create an embedding provider using @xenova/transformers.
 */
export function createXenovaEmbeddingProvider(
  modelName: string = DEFAULT_MODEL
): EmbeddingProvider {
  let _dimensions: number | null = null;

  return {
    name: `xenova-${modelName}`,
    get dimensions(): number {
      return _dimensions || 384; // Default for all-MiniLM-L6-v2
    },

    async embed(texts: string[]): Promise<number[][]> {
      const pipe = await loadPipeline(modelName);

      const results: number[][] = [];

      // Process in batches to avoid OOM
      const BATCH_SIZE = 32;
      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        const output = await pipe(batch, {
          pooling: 'mean',    // Mean pooling
          normalize: true,     // L2 normalize
        });

        // Extract embeddings from output
        for (let j = 0; j < batch.length; j++) {
          const embedding = Array.from(output[j].data) as number[];
          if (_dimensions === null) {
            _dimensions = embedding.length;
          }
          results.push(embedding);
        }
      }

      return results;
    },
  };
}

/**
 * Fallback: Simple hash-based embedding (no ML model needed).
 * Good enough for keyword matching, not true semantic search.
 * Used when @xenova/transformers fails to load.
 */
export function createHashEmbeddingProvider(dimensions: number = 384): EmbeddingProvider {
  return {
    name: `hash-${dimensions}`,
    dimensions,

    async embed(texts: string[]): Promise<number[][]> {
      return texts.map((text) => hashEmbed(text, dimensions));
    },
  };
}

function hashEmbed(text: string, dims: number): number[] {
  const vec = new Float32Array(dims);
  const tokens = text.toLowerCase().replace(/[^\w\sก-๙]/g, ' ').split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % dims;
    vec[idx] += 1;
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dims; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dims; i++) vec[i] /= norm;

  return Array.from(vec);
}
