import { Database } from "bun:sqlite";
import { vectorSearch, type VectorResult } from "./vector-index";
import { ftsSearch, type FtsResult } from "./fts-index";
import { isEmbedderReady } from "./embedder";

const VECTOR_WEIGHT = 0.6;
const FTS_WEIGHT = 0.4;

export interface SearchResult {
  id: number;
  content: string;
  sourceFile: string;
  score: number;
}

/**
 * Hybrid search: weighted union of vector similarity and BM25 keyword search.
 * Falls back to FTS-only when embedder is not available.
 */
export async function hybridSearch(
  db: Database,
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  const scoreMap = new Map<
    number,
    { content: string; sourceFile: string; score: number }
  >();

  // FTS search (always available)
  const ftsResults = ftsSearch(db, query, limit * 2);
  for (const r of ftsResults) {
    const existing = scoreMap.get(r.id);
    const ftsWeight = isEmbedderReady() ? FTS_WEIGHT : 1.0;
    const score = r.score * ftsWeight;
    if (existing) {
      existing.score += score;
    } else {
      scoreMap.set(r.id, {
        content: r.content,
        sourceFile: r.sourceFile,
        score,
      });
    }
  }

  // Vector search (when embedder is ready)
  if (isEmbedderReady()) {
    const vecResults = await vectorSearch(db, query, limit * 2);
    for (const r of vecResults) {
      const existing = scoreMap.get(r.id);
      const score = r.score * VECTOR_WEIGHT;
      if (existing) {
        existing.score += score;
      } else {
        scoreMap.set(r.id, {
          content: r.content,
          sourceFile: r.sourceFile,
          score,
        });
      }
    }
  }

  // Sort by combined score
  const results = Array.from(scoreMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}
