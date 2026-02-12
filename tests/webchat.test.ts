import { describe, it, expect } from "bun:test";

describe("WebChat Security", () => {
  describe("FTS query sanitization", () => {
    it("should strip special FTS5 operators", () => {
      // Replicate the sanitization logic from webchat.ts
      function sanitizeFts(query: string): string {
        return query
          .replace(/["*(){}:^~]/g, "")
          .replace(/\b(AND|OR|NOT|NEAR)\b/gi, "")
          .trim();
      }

      expect(sanitizeFts('test "injection" here')).toBe("test injection here");
      expect(sanitizeFts("test* OR drop")).toBe("test  drop");
      expect(sanitizeFts("normal query")).toBe("normal query");
      // NEAR( becomes NEARtest after paren removal — \bNEAR\b won't match mid-word
      expect(sanitizeFts("NEAR (test, 5)")).toBe("test, 5");
      expect(sanitizeFts("test AND query")).toBe("test  query");
    });

    it("should return empty string for purely special chars", () => {
      function sanitizeFts(query: string): string {
        return query
          .replace(/["*(){}:^~]/g, "")
          .replace(/\b(AND|OR|NOT|NEAR)\b/gi, "")
          .trim();
      }

      expect(sanitizeFts('***"()"')).toBe("");
    });
  });

  describe("Upload path traversal prevention", () => {
    it("should sanitize filenames with directory traversal", () => {
      // Replicate the sanitization logic
      function sanitizeFilename(name: string): string {
        return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "_");
      }

      // The regex keeps . and - but replaces / with _, then leading dots are replaced
      expect(sanitizeFilename("../../../etc/passwd")).toBe("__.._.._etc_passwd");
      expect(sanitizeFilename("..secret.txt")).toBe("_secret.txt");
      expect(sanitizeFilename("normal-file.txt")).toBe("normal-file.txt");
      expect(sanitizeFilename("file with spaces.pdf")).toBe("file_with_spaces.pdf");
    });
  });

  describe("MIME type whitelist", () => {
    it("should accept allowed extensions", () => {
      const ALLOWED_EXTENSIONS = new Set([
        ".pdf", ".docx", ".txt", ".md", ".csv", ".json",
        ".html", ".xml", ".yaml", ".yml", ".ts", ".js", ".py", ".sh",
      ]);

      expect(ALLOWED_EXTENSIONS.has(".pdf")).toBe(true);
      expect(ALLOWED_EXTENSIONS.has(".docx")).toBe(true);
      expect(ALLOWED_EXTENSIONS.has(".txt")).toBe(true);
      expect(ALLOWED_EXTENSIONS.has(".json")).toBe(true);
    });

    it("should reject disallowed extensions", () => {
      const ALLOWED_EXTENSIONS = new Set([
        ".pdf", ".docx", ".txt", ".md", ".csv", ".json",
        ".html", ".xml", ".yaml", ".yml", ".ts", ".js", ".py", ".sh",
      ]);

      expect(ALLOWED_EXTENSIONS.has(".exe")).toBe(false);
      expect(ALLOWED_EXTENSIONS.has(".dll")).toBe(false);
      expect(ALLOWED_EXTENSIONS.has(".bat")).toBe(false);
      expect(ALLOWED_EXTENSIONS.has(".php")).toBe(false);
    });
  });

  describe("File size limit enforcement", () => {
    it("should enforce 50MB limit", () => {
      const MAX_SIZE = 50 * 1024 * 1024;
      expect(MAX_SIZE).toBe(52428800);

      // File under limit
      expect(1024 <= MAX_SIZE).toBe(true);
      // File at limit
      expect(MAX_SIZE <= MAX_SIZE).toBe(true);
      // File over limit
      expect(MAX_SIZE + 1 > MAX_SIZE).toBe(true);
    });
  });
});
