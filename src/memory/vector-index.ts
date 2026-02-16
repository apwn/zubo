import { Database } from "bun:sqlite";
import { embed, cosineSimilarity, isEmbedderReady } from "./embedder";
import { logger } from "../util/logger";

export interface VectorResult {
  id: number;
  content: string;
  sourceFile: string;
  score: number;
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

  const rows = db
    .query(
      "SELECT id, content, source_file, embedding FROM memory_chunks WHERE embedding IS NOT NULL ORDER BY id DESC LIMIT 500"
    )
    .all() as Array<{
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
