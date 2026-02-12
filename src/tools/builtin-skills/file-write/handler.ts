import { homedir } from "os";
import { appendFileSync } from "fs";

export default async function (input: Record<string, unknown>): Promise<string> {
  let path = input.path as string;
  const content = input.content as string;
  const append = (input.append as boolean) || false;

  // Expand ~
  if (path.startsWith("~/")) {
    path = path.replace("~", homedir());
  }

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
