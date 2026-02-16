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

declare module "xlsx" {
  interface Sheet {
    [key: string]: unknown;
  }
  interface Workbook {
    SheetNames: string[];
    Sheets: Record<string, Sheet>;
  }
  interface Utils {
    sheet_to_csv(sheet: Sheet): string;
  }
  function read(data: Buffer | ArrayBuffer, opts?: { type?: string }): Workbook;
  const utils: Utils;
  export { read, utils, Workbook, Sheet };
  export default { read, utils };
}

declare module "jszip" {
  interface JSZipObject {
    async(type: "text"): Promise<string>;
    async(type: "arraybuffer"): Promise<ArrayBuffer>;
    async(type: "uint8array"): Promise<Uint8Array>;
    async(type: "nodebuffer"): Promise<Buffer>;
  }
  interface JSZip {
    file(name: string): JSZipObject | null;
    forEach(callback: (relativePath: string, file: JSZipObject) => void): void;
  }
  interface JSZipStatic {
    loadAsync(data: Buffer | ArrayBuffer | Uint8Array): Promise<JSZip>;
  }
  const JSZip: JSZipStatic;
  export default JSZip;
}
