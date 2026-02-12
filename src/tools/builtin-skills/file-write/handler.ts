import { homedir } from "os";
import { resolve } from "path";
import { appendFileSync } from "fs";

const BLOCKED_PATHS = [
  "/.ssh/",
  "/.gnupg/",
  "/.aws/credentials",
  "/.orba/config.json",
  "/id_rsa",
  "/id_ed25519",
  "/.env",
  "/.bashrc",
  "/.bash_profile",
  "/.zshrc",
  "/.profile",
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
    throw new Error(`Access denied: writes are restricted to your home directory`);
  }

  // Block sensitive paths
  for (const blocked of BLOCKED_PATHS) {
    if (p.includes(blocked)) {
      throw new Error(`Access denied: cannot write to sensitive path (${blocked})`);
    }
  }

  return p;
}

export default async function (input: Record<string, unknown>): Promise<string> {
  const rawPath = input.path as string;
  const content = input.content as string;
  const append = (input.append as boolean) || false;

  const path = validatePath(rawPath);

  if (append) {
    appendFileSync(path, content);
  } else {
    await Bun.write(path, content);
  }

  return JSON.stringify({
    path,
    bytesWritten: content.length,
    mode: append ? "append" : "write",
  });
}
