import { homedir } from "os";

export default async function (input: Record<string, unknown>): Promise<string> {
  let path = input.path as string;
  const maxLength = (input.maxLength as number) || 50000;

  // Expand ~
  if (path.startsWith("~/")) {
    path = path.replace("~", homedir());
  }

  const file = Bun.file(path);
  const exists = await file.exists();

  if (!exists) {
    throw new Error(`File not found: ${path}`);
  }

  let content = await file.text();

  if (content.length > maxLength) {
    content = content.slice(0, maxLength) + "\n\n[Truncated]";
  }

  return JSON.stringify({ path, size: file.size, content });
}
