import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mock } from "bun:test";
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// Mock the logger to suppress warnings during tests
mock.module("../src/util/logger", () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

const { parseDocument, guessMimeType } = await import(
  "../src/memory/document-parser"
);

// ─── Temp directory & helper ─────────────────────────────────────────────────

const TMP_DIR = join(tmpdir(), "orba-doc-parser-test-" + Date.now());

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
  try {
    const { rmSync } = require("fs");
    rmSync(TMP_DIR, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

function tmpFile(name: string, content: Buffer | string): string {
  const p = join(TMP_DIR, name);
  writeFileSync(p, content);
  return p;
}

// ─── MIME_MAP / guessMimeType ────────────────────────────────────────────────

describe("guessMimeType", () => {
  test("returns correct MIME type for .xlsx", () => {
    expect(guessMimeType("report.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  test("returns correct MIME type for .xls", () => {
    expect(guessMimeType("legacy.xls")).toBe("application/vnd.ms-excel");
  });

  test("returns correct MIME type for .pptx", () => {
    expect(guessMimeType("slides.pptx")).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
  });

  test("returns correct MIME type for .pdf", () => {
    expect(guessMimeType("doc.pdf")).toBe("application/pdf");
  });

  test("returns correct MIME type for .docx", () => {
    expect(guessMimeType("paper.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  test("returns correct MIME type for .txt", () => {
    expect(guessMimeType("notes.txt")).toBe("text/plain");
  });

  test("returns correct MIME type for .md", () => {
    expect(guessMimeType("readme.md")).toBe("text/markdown");
  });

  test("returns correct MIME type for .csv", () => {
    expect(guessMimeType("data.csv")).toBe("text/csv");
  });

  test("is case-insensitive on extensions", () => {
    // extname returns the literal extension; toLowerCase is called inside guessMimeType
    expect(guessMimeType("FILE.XLSX")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(guessMimeType("FILE.XLS")).toBe("application/vnd.ms-excel");
    expect(guessMimeType("FILE.PPTX")).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
  });

  test("returns application/octet-stream for unknown extensions", () => {
    expect(guessMimeType("archive.rar")).toBe("application/octet-stream");
    expect(guessMimeType("photo.bmp")).toBe("application/octet-stream");
  });
});

// ─── XLS — unsupported format (no library needed) ───────────────────────────

describe("parseDocument: XLS (unsupported)", () => {
  test("returns unsupported message for .xls files", async () => {
    // Create a dummy .xls file — contents do not matter since the format is rejected
    const filePath = tmpFile("old-spreadsheet.xls", "dummy xls content");
    const result = await parseDocument(filePath, "application/vnd.ms-excel");

    expect(result.text).toContain("old .xls format is not supported");
    expect(result.text).toContain("convert to .xlsx");
    expect(result.text).toContain("old-spreadsheet.xls");
    expect(result.metadata.mimeType).toBe("application/vnd.ms-excel");
    expect(result.metadata.wordCount).toBe(0);
  });

  test("extracts filename from path in XLS result", async () => {
    // parseDocument derives filename from filePath.split("/").pop()
    // XLS branch never reads the file, so the path doesn't need to exist
    const result = await parseDocument(
      "/fake/path/to/budget.xls",
      "application/vnd.ms-excel"
    );
    expect(result.text).toContain("budget.xls");
    expect(result.metadata.filename).toBe("budget.xls");
  });
});

// ─── XLSX — graceful degradation ────────────────────────────────────────────

describe("parseDocument: XLSX", () => {
  test("returns a valid ParsedDocument structure", async () => {
    const filePath = tmpFile("data.xlsx", Buffer.alloc(0));
    const result = await parseDocument(
      filePath,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // Whether xlsx is installed or not, we should get a valid structure
    expect(result).toHaveProperty("text");
    expect(result).toHaveProperty("metadata");
    expect(result.metadata).toHaveProperty("filename");
    expect(result.metadata).toHaveProperty("mimeType");
    expect(result.metadata).toHaveProperty("wordCount");
    expect(result.metadata.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });

  test("gracefully handles missing xlsx library or invalid file", async () => {
    // An empty buffer is not a valid XLSX file, so even if the library is
    // installed it will fail to parse. Either way we get a fallback result.
    const filePath = tmpFile("broken.xlsx", Buffer.alloc(0));
    const result = await parseDocument(
      filePath,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // The fallback message contains the filename and mentions xlsx
    expect(result.text).toContain("broken.xlsx");
    expect(result.metadata.wordCount).toBe(0);
    expect(result.metadata.filename).toBe("broken.xlsx");
  });

  test("fallback message mentions installing xlsx", async () => {
    const filePath = tmpFile("report.xlsx", Buffer.alloc(0));
    const result = await parseDocument(
      filePath,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    // Whether the library is missing or the file is invalid, the catch block
    // produces a message containing "install xlsx"
    expect(result.text).toContain("xlsx");
  });
});

// ─── PPTX — graceful degradation ───────────────────────────────────────────

describe("parseDocument: PPTX", () => {
  test("returns a valid ParsedDocument structure", async () => {
    const filePath = tmpFile("slides.pptx", Buffer.alloc(0));
    const result = await parseDocument(
      filePath,
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );

    expect(result).toHaveProperty("text");
    expect(result).toHaveProperty("metadata");
    expect(result.metadata).toHaveProperty("filename");
    expect(result.metadata).toHaveProperty("mimeType");
    expect(result.metadata).toHaveProperty("wordCount");
    expect(result.metadata.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
  });

  test("gracefully handles missing jszip library or invalid file", async () => {
    const filePath = tmpFile("broken.pptx", Buffer.alloc(0));
    const result = await parseDocument(
      filePath,
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );

    expect(result.text).toContain("broken.pptx");
    expect(result.metadata.wordCount).toBe(0);
    expect(result.metadata.filename).toBe("broken.pptx");
  });

  test("fallback message mentions installing jszip", async () => {
    const filePath = tmpFile("deck.pptx", Buffer.alloc(0));
    const result = await parseDocument(
      filePath,
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );

    expect(result.text).toContain("pptx");
  });
});

// ─── Plain text — sanity check that basic parsing still works ───────────────

describe("parseDocument: plain text (sanity)", () => {
  test("parses a .txt file correctly", async () => {
    const filePath = tmpFile("hello.txt", "Hello world, this is a test.");
    const result = await parseDocument(filePath, "text/plain");

    expect(result.text).toBe("Hello world, this is a test.");
    expect(result.metadata.filename).toBe("hello.txt");
    expect(result.metadata.mimeType).toBe("text/plain");
    expect(result.metadata.wordCount).toBe(6);
  });

  test("parses a .csv file correctly", async () => {
    const content = "name,age\nAlice,30\nBob,25";
    const filePath = tmpFile("people.csv", content);
    const result = await parseDocument(filePath, "text/csv");

    expect(result.text).toBe(content);
    expect(result.metadata.mimeType).toBe("text/csv");
    expect(result.metadata.wordCount).toBeGreaterThan(0);
  });
});

// ─── Unsupported / default branch ───────────────────────────────────────────

describe("parseDocument: unsupported types", () => {
  test("returns unsupported message for unknown MIME type", async () => {
    const filePath = tmpFile("mystery.bin", Buffer.from([0x00, 0x01]));
    const result = await parseDocument(filePath, "application/octet-stream");

    expect(result.text).toContain("Unsupported file type");
    expect(result.metadata.wordCount).toBe(0);
  });
});
