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

    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      try {
        const XLSX = (await import("xlsx")).default ?? (await import("xlsx"));
        const workbook = XLSX.read(readFileSync(filePath), { type: "buffer" });
        const parts: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          parts.push(`Sheet: ${sheetName}\n${csv}`);
        }
        const text = parts.join("\n\n");
        return {
          text,
          metadata: { filename, mimeType, wordCount: countWords(text) },
        };
      } catch (err: any) {
        logger.warn("XLSX parsing failed — install xlsx (SheetJS) for XLSX support", { error: err.message });
        return {
          text: `[XLSX file: ${filename} — install xlsx for content extraction]`,
          metadata: { filename, mimeType, wordCount: 0 },
        };
      }
    }

    case "application/vnd.ms-excel": {
      return {
        text: `[XLS file: ${filename} — old .xls format is not supported, please convert to .xlsx]`,
        metadata: { filename, mimeType, wordCount: 0 },
      };
    }

    case "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
      try {
        const JSZip = (await import("jszip")).default ?? (await import("jszip"));
        const buffer = readFileSync(filePath);
        const zip = await JSZip.loadAsync(buffer);

        // Collect slide files and sort by slide number
        const slideFiles: { num: number; path: string }[] = [];
        zip.forEach((relativePath: string) => {
          const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/);
          if (match) {
            slideFiles.push({ num: parseInt(match[1], 10), path: relativePath });
          }
        });
        slideFiles.sort((a, b) => a.num - b.num);

        const parts: string[] = [];
        for (const slide of slideFiles) {
          const xml = await zip.file(slide.path)!.async("text");
          // Extract text content from XML — pull all <a:t> tag values
          const textParts: string[] = [];
          const regex = /<a:t>([\s\S]*?)<\/a:t>/g;
          let m: RegExpExecArray | null;
          while ((m = regex.exec(xml)) !== null) {
            const content = m[1].trim();
            if (content) textParts.push(content);
          }
          parts.push(`Slide ${slide.num}:\n${textParts.join(" ")}`);
        }
        const text = parts.join("\n\n");
        return {
          text,
          metadata: {
            filename,
            mimeType,
            pages: slideFiles.length,
            wordCount: countWords(text),
          },
        };
      } catch (err: any) {
        logger.warn("PPTX parsing failed — install jszip for PPTX support", { error: err.message });
        return {
          text: `[PPTX file: ${filename} — install jszip for content extraction]`,
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
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".json": "application/json",
  ".xml": "application/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
};

export function guessMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return MIME_MAP[ext] ?? "application/octet-stream";
}
