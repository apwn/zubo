import { homedir } from "os";
import { resolve } from "path";

const BLOCKED_PATHS = [
  "/.ssh/",
  "/.gnupg/",
  "/.aws/credentials",
  "/.orba/config.json",
  "/id_rsa",
  "/id_ed25519",
  "/.env",
];

function validatePath(rawPath: string): string {
  let p = rawPath;

  // Expand ~
  if (p.startsWith("~/")) {
    p = p.replace("~", homedir());
  }

  // Resolve to absolute, eliminating .. traversals
  p = resolve(p);

  // Must be under home directory
  const home = homedir();
  if (!p.startsWith(home + "/") && p !== home) {
    throw new Error(`Access denied: reads are restricted to your home directory`);
  }

  // Block sensitive paths
  for (const blocked of BLOCKED_PATHS) {
    if (p.includes(blocked)) {
      throw new Error(`Access denied: cannot read sensitive path (${blocked})`);
    }
  }

  return p;
}

export default async function (input: Record<string, unknown>): Promise<string> {
  const rawPath = input.path as string;
  const maxLength = (input.maxLength as number) || 50000;

  const path = validatePath(rawPath);

  const file = Bun.file(path);
  const exists = await file.exists();

  if (!exists) {
    throw new Error(`File not found: ${path}`);
  }

  let content = await file.text();
  const size = content.length;

  if (content.length > maxLength) {
    content = content.slice(0, maxLength) + "\n\n[Truncated]";
  }

  return JSON.stringify({ path, size, contentLength: content.length, content });
}
