import { paths } from "../config/paths";
import { join } from "path";
import { existsSync, readdirSync, readFileSync, appendFileSync } from "fs";

/**
 * Read all markdown memory files from the workspace.
 */
export function readAllMemoryFiles(): Array<{
  filePath: string;
  content: string;
}> {
  const files: Array<{ filePath: string; content: string }> = [];

  // Read MEMORY.md
  if (existsSync(paths.memoryFile)) {
    files.push({
      filePath: paths.memoryFile,
      content: readFileSync(paths.memoryFile, "utf-8"),
    });
  }

  // Read dated memory files
  if (existsSync(paths.memory)) {
    const memFiles = readdirSync(paths.memory).filter((f) =>
      f.endsWith(".md")
    );
    for (const f of memFiles) {
      const fp = join(paths.memory, f);
      files.push({
        filePath: fp,
        content: readFileSync(fp, "utf-8"),
      });
    }
  }

  return files;
}

/**
 * Append a memory entry to today's dated memory file.
 */
export function writeMemory(content: string): string {
  const today = new Date().toISOString().split("T")[0];
  const filePath = join(paths.memory, `${today}.md`);

  if (!existsSync(filePath)) {
    Bun.spawnSync(["mkdir", "-p", paths.memory]);
    const header = `# Memories — ${today}\n\n`;
    appendFileSync(filePath, header);
  }

  const entry = `- ${content}\n`;
  appendFileSync(filePath, entry);

  return filePath;
}
