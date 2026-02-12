import { estimateTokens } from "../util/tokens";

const CHUNK_SIZE = 400; // tokens
const CHUNK_OVERLAP = 80; // tokens
const CHARS_PER_TOKEN = 4;

export interface Chunk {
  content: string;
  index: number;
  sourceFile: string;
}

/**
 * Split text into overlapping chunks of ~400 tokens.
 */
export function chunkText(text: string, sourceFile: string): Chunk[] {
  const chunks: Chunk[] = [];
  const chunkChars = CHUNK_SIZE * CHARS_PER_TOKEN;
  const overlapChars = CHUNK_OVERLAP * CHARS_PER_TOKEN;
  const step = chunkChars - overlapChars;

  if (text.length <= chunkChars) {
    return [{ content: text.trim(), index: 0, sourceFile }];
  }

  let offset = 0;
  let idx = 0;
  while (offset < text.length) {
    let end = offset + chunkChars;
    if (end > text.length) end = text.length;

    // Try to break at a paragraph or sentence boundary
    if (end < text.length) {
      const slice = text.slice(offset, end);
      const lastPara = slice.lastIndexOf("\n\n");
      const lastNewline = slice.lastIndexOf("\n");
      const lastPeriod = slice.lastIndexOf(". ");

      if (lastPara > chunkChars * 0.5) {
        end = offset + lastPara + 2;
      } else if (lastNewline > chunkChars * 0.5) {
        end = offset + lastNewline + 1;
      } else if (lastPeriod > chunkChars * 0.5) {
        end = offset + lastPeriod + 2;
      }
    }

    const chunk = text.slice(offset, end).trim();
    if (chunk.length > 0) {
      chunks.push({ content: chunk, index: idx++, sourceFile });
    }

    offset += step;
    if (offset >= text.length) break;
  }

  return chunks;
}
