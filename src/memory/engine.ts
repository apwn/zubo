import { Database } from "bun:sqlite";
import { readAllMemoryFiles, writeMemory } from "./store";
import { chunkText, type Chunk } from "./chunker";
import { initEmbedder, embed, isEmbedderReady } from "./embedder";
import { storeEmbedding } from "./vector-index";
import { hybridSearch, type SearchResult } from "./hybrid-search";
import { ftsSearch } from "./fts-index";
import { logger } from "../util/logger";

/**
 * Initialize the memory engine: load embedder, index existing files.
 */
export async function initMemory(db: Database): Promise<void> {
  // Try to initialize the embedder (non-blocking if it fails)
  const embedderOk = await initEmbedder();
  if (!embedderOk) {
    logger.warn("Running memory with FTS-only (no vector embeddings)");
  }

  // Index existing memory files
  await indexAllFiles(db);
}

/**
 * Index all memory files: chunk → store in DB → embed.
 */
export async function indexAllFiles(db: Database): Promise<number> {
  const files = readAllMemoryFiles();
  let totalChunks = 0;

  for (const file of files) {
    const chunks = chunkText(file.content, file.filePath);
    for (const chunk of chunks) {
      const existing = db
        .query(
          "SELECT id FROM memory_chunks WHERE source_file = ? AND chunk_index = ?"
        )
        .get(chunk.sourceFile, chunk.index) as { id: number } | null;

      let chunkId: number;
      if (existing) {
        // Update existing chunk
        db.prepare(
          "UPDATE memory_chunks SET content = ? WHERE id = ?"
        ).run(chunk.content, existing.id);
        chunkId = existing.id;
      } else {
        // Insert new chunk
        const result = db
          .prepare(
            "INSERT INTO memory_chunks (source_file, chunk_index, content) VALUES (?, ?, ?)"
          )
          .run(chunk.sourceFile, chunk.index, chunk.content);
        chunkId = Number(result.lastInsertRowid);
      }

      // Generate and store embedding
      if (isEmbedderReady()) {
        const embedding = await embed(chunk.content);
        if (embedding) {
          await storeEmbedding(db, chunkId, embedding);
        }
      }

      totalChunks++;
    }
  }

  logger.info("Memory indexed", { files: files.length, chunks: totalChunks });
  return totalChunks;
}

/**
 * Write a memory and index it immediately.
 */
export async function writeAndIndexMemory(
  db: Database,
  content: string
): Promise<void> {
  const filePath = writeMemory(content);

  // Atomically get next index and insert in a transaction
  const chunkId = db.transaction(() => {
    const existing = db
      .query("SELECT MAX(chunk_index) as maxIdx FROM memory_chunks WHERE source_file = ?")
      .get(filePath) as { maxIdx: number | null } | null;

    const nextIdx = (existing?.maxIdx ?? -1) + 1;

    const result = db
      .prepare(
        "INSERT INTO memory_chunks (source_file, chunk_index, content) VALUES (?, ?, ?)"
      )
      .run(filePath, nextIdx, content);

    return Number(result.lastInsertRowid);
  })();

  // Embed outside transaction (async not allowed inside)
  if (isEmbedderReady()) {
    const embedding = await embed(content);
    if (embedding) {
      await storeEmbedding(db, chunkId, embedding);
    }
  }

  logger.info("Memory written and indexed", { filePath, content: content.slice(0, 50) });
}

/**
 * Search memory using FTS (synchronous, for use in router).
 */
export function searchMemory(
  db: Database,
  query: string,
  limit: number = 5
): SearchResult[] {
  return ftsSearch(db, query, limit);
}

/**
 * Async hybrid search (vector + FTS).
 */
export async function searchMemoryAsync(
  db: Database,
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  return hybridSearch(db, query, limit);
}
