import { readFileSync } from "fs";
import { extname } from "path";
import { logger } from "../util/logger";

export interface ParsedDocument {
  text: string;
  metadata: {
    filename: string;
    mimeType: string;
    pages?: number;
    wordCount: number;
  };
}

export async function parseDocument(
  filePath: string,
  mimeType: string
): Promise<ParsedDocument> {
  const filename = filePath.split("/").pop() ?? "unknown";

  switch (mimeType) {
    case "text/plain":
    case "text/markdown":
    case "text/csv": {
      const text = readFileSync(filePath, "utf-8");
      return {
        text,
        metadata: { filename, mimeType, wordCount: countWords(text) },
      };
    }

    case "application/pdf": {
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const buffer = readFileSync(filePath);
        const MAX_TEXT_LENGTH = 5_000_000; // 5MB of text
        const TIMEOUT_MS = 30_000;
        const data = await Promise.race([
          pdfParse(buffer) as Promise<{ text: string; numpages: number }>,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("PDF parsing timeout")), TIMEOUT_MS)),
        ]);
        const text = data.text.length > MAX_TEXT_LENGTH ? data.text.slice(0, MAX_TEXT_LENGTH) + "\n[Truncated]" : data.text;
        return {
          text,
          metadata: {
            filename,
            mimeType,
            pages: data.numpages,
            wordCount: countWords(text),
          },
        };
      } catch (err: any) {
        logger.warn("PDF parsing failed — install pdf-parse for PDF support", { error: err.message });
        return {
          text: `[PDF file: ${filename} — install pdf-parse for content extraction]`,
          metadata: { filename, mimeType, wordCount: 0 },
        };
      }
    }

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer: readFileSync(filePath) });
        return {
          text: result.value,
          metadata: { filename, mimeType, wordCount: countWords(result.value) },
        };
      } catch (err: any) {
        logger.warn("DOCX parsing failed — install mammoth for DOCX support", { error: err.message });
        return {
          text: `[DOCX file: ${filename} — install mammoth for content extraction]`,
          metadata: { filename, mimeType, wordCount: 0 },
        };
      }
    }

    default: {
      // Try to read as text
      const ext = extname(filePath).toLowerCase();
      if ([".txt", ".md", ".csv", ".json", ".xml", ".yaml", ".yml", ".ts", ".js", ".py", ".sh"].includes(ext)) {
        const text = readFileSync(filePath, "utf-8");
        return {
          text,
          metadata: { filename, mimeType, wordCount: countWords(text) },
        };
      }
      return {
        text: `[Unsupported file type: ${mimeType}]`,
        metadata: { filename, mimeType, wordCount: 0 },
      };
    }
  }
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

const MIME_MAP: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".json": "application/json",
  ".xml": "application/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
};

export function guessMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return MIME_MAP[ext] ?? "application/octet-stream";
}
