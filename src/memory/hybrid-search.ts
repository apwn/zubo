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
  confidence?: number;
  matchType?: "fts" | "vector" | "hybrid";
  reasons?: string[];
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
    {
      content: string;
      sourceFile: string;
      score: number;
      ftsScore: number;
      vectorScore: number;
    }
  >();

  // FTS search (always available)
  const ftsResults = ftsSearch(db, query, limit * 2);
  for (const r of ftsResults) {
    const existing = scoreMap.get(r.id);
    const ftsWeight = isEmbedderReady() ? FTS_WEIGHT : 1.0;
    const score = r.score * ftsWeight;
    if (existing) {
      existing.score += score;
      existing.ftsScore += r.score;
    } else {
      scoreMap.set(r.id, {
        content: r.content,
        sourceFile: r.sourceFile,
        score,
        ftsScore: r.score,
        vectorScore: 0,
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
        existing.vectorScore += r.score;
      } else {
        scoreMap.set(r.id, {
          content: r.content,
          sourceFile: r.sourceFile,
          score,
          ftsScore: 0,
          vectorScore: r.score,
        });
      }
    }
  }

  // Sort by combined score
  const results = Array.from(scoreMap.entries())
    .map(([id, data]) => {
      const hasFts = data.ftsScore > 0;
      const hasVector = data.vectorScore > 0;
      const confidence = Math.max(0, Math.min(1, data.score));
      const matchType: "fts" | "vector" | "hybrid" =
        hasFts && hasVector ? "hybrid" : hasVector ? "vector" : "fts";
      const reasons = [
        hasFts ? "keyword match" : "",
        hasVector ? "semantic match" : "",
      ].filter(Boolean);
      return { id, ...data, confidence, matchType, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}
