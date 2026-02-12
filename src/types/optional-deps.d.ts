// Type declarations for optional dependencies that may not be installed.
// These modules are dynamically imported inside try/catch blocks.

declare module "pdf-parse" {
  interface PdfData {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    text: string;
    version: string;
  }
  function pdfParse(buffer: Buffer): Promise<PdfData>;
  export default pdfParse;
}

declare module "mammoth" {
  interface ExtractResult {
    value: string;
    messages: unknown[];
  }
  export function extractRawText(options: { buffer: Buffer }): Promise<ExtractResult>;
}
