import { Database } from "bun:sqlite";
import { embed, cosineSimilarity, isEmbedderReady } from "./embedder";
import { logger } from "../util/logger";
import { readFileSync, statSync } from "fs";
import { paths } from "../config/paths";

export interface VectorResult {
  id: number;
  content: string;
  sourceFile: string;
  score: number;
}

const vectorCandidateLimitCache: { mtimeMs: number; value: number } = {
  mtimeMs: -1,
  value: 2000,
};

function getVectorCandidateLimit(): number {
  try {
    const mtimeMs = statSync(paths.config).mtimeMs;
    if (vectorCandidateLimitCache.mtimeMs === mtimeMs) {
      return vectorCandidateLimitCache.value;
    }
    const cfg = JSON.parse(readFileSync(paths.config, "utf-8"));
    const raw = Number(cfg?.memoryRetrieval?.vectorCandidateLimit ?? 2000);
    const parsed = Math.max(100, Math.min(50_000, Number.isFinite(raw) ? raw : 2000));
    vectorCandidateLimitCache.mtimeMs = mtimeMs;
    vectorCandidateLimitCache.value = parsed;
    return parsed;
  } catch {
    return vectorCandidateLimitCache.value;
  }
}

/**
 * Store embedding as blob in memory_chunks table.
 */
export async function storeEmbedding(
  db: Database,
  chunkId: number,
  embedding: Float32Array
) {
  const blob = Buffer.from(embedding.buffer);
  db.prepare("UPDATE memory_chunks SET embedding = ? WHERE id = ?").run(
    blob,
    chunkId
  );
}

/**
 * Vector search using cosine similarity computed in JS.
 * Since sqlite-vec can't load, we pull all embeddings and compute in memory.
 * This is fine for personal memory (<10k chunks).
 */
export async function vectorSearch(
  db: Database,
  query: string,
  limit: number = 5
): Promise<VectorResult[]> {
  if (!isEmbedderReady()) return [];

  const queryEmbedding = await embed(query);
  if (!queryEmbedding) return [];
  const candidateLimit = getVectorCandidateLimit();

  const rows = db
    .query(
      "SELECT id, content, source_file, embedding FROM memory_chunks WHERE embedding IS NOT NULL ORDER BY id DESC LIMIT ?"
    )
    .all(candidateLimit) as Array<{
    id: number;
    content: string;
    source_file: string;
    embedding: Buffer;
  }>;

  const scored: VectorResult[] = [];
  for (const row of rows) {
    if (!row.embedding) continue;
    const emb = new Float32Array(
      row.embedding.buffer,
      row.embedding.byteOffset,
      row.embedding.byteLength / 4
    );
    const score = cosineSimilarity(queryEmbedding, emb);
    scored.push({
      id: row.id,
      content: row.content,
      sourceFile: row.source_file,
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
