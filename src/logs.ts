import { existsSync, readFileSync, watchFile } from "fs";
import { paths } from "./config/paths";
import { logger } from "./util/logger";

export async function showLogs(follow = false) {
  if (!existsSync(paths.logFile)) {
    console.log("No log file found. Start Zubo first.");
    return;
  }

  if (follow) {
    await tailFollow();
  } else {
    tailLast(50);
  }
}

function tailLast(n: number) {
  const content = readFileSync(paths.logFile, "utf-8");
  const lines = content.trimEnd().split("\n");
  const tail = lines.slice(-n);
  console.log(tail.join("\n"));
}

async function tailFollow() {
  // Print last 10 lines first
  tailLast(10);
  console.log("--- following logs (Ctrl+C to stop) ---\n");

  let pos = readFileSync(paths.logFile).byteLength;

  watchFile(paths.logFile, { interval: 500 }, () => {
    try {
      const buf = readFileSync(paths.logFile);
      if (buf.byteLength > pos) {
        const newData = buf.subarray(pos).toString();
        process.stdout.write(newData);
        pos = buf.byteLength;
      } else if (buf.byteLength < pos) {
        // File was truncated/rotated
        pos = 0;
        const newData = buf.toString();
        process.stdout.write(newData);
        pos = buf.byteLength;
      }
    } catch (err: any) {
      logger.warn("Failed to read log file update", { error: (err as Error).message });
    }
  });

  // Keep process alive
  await new Promise(() => {});
}
