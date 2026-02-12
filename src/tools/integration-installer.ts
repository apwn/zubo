import { readdirSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const INTEGRATIONS_DIR = join(import.meta.dir, "builtin-integrations");

export interface IntegrationInfo {
  service: string;
  skills: string[];
  secret_name: string;
}

const SERVICE_SECRETS: Record<string, string> = {
  github: "github_token",
  google: "google_api_key",
  notion: "notion_token",
};

/**
 * Lists available integrations by scanning the builtin-integrations directory.
 */
export function listAvailableIntegrations(): IntegrationInfo[] {
  const integrations: IntegrationInfo[] = [];

  let services: string[];
  try {
    services = readdirSync(INTEGRATIONS_DIR);
  } catch {
    return [];
  }

  for (const service of services) {
    const serviceDir = join(INTEGRATIONS_DIR, service);
    let entries: string[];
    try {
      entries = readdirSync(serviceDir);
    } catch {
      continue;
    }

    const skills: string[] = [];
    for (const entry of entries) {
      const skillDir = join(serviceDir, entry);
      if (
        existsSync(join(skillDir, "SKILL.md")) &&
        existsSync(join(skillDir, "handler.ts"))
      ) {
        skills.push(entry);
      }
    }

    if (skills.length > 0) {
      integrations.push({
        service,
        skills,
        secret_name: SERVICE_SECRETS[service] || `${service}_token`,
      });
    }
  }

  return integrations;
}

/**
 * Installs integration skill templates to the user's skills directory.
 * Returns list of installed skill names.
 */
export function installIntegration(targetDir: string, service: string): string[] {
  const serviceDir = join(INTEGRATIONS_DIR, service);
  if (!existsSync(serviceDir)) return [];

  let entries: string[];
  try {
    entries = readdirSync(serviceDir);
  } catch {
    return [];
  }

  const installed: string[] = [];

  for (const entry of entries) {
    const srcDir = join(serviceDir, entry);
    const skillMd = join(srcDir, "SKILL.md");
    const handlerTs = join(srcDir, "handler.ts");

    if (!existsSync(skillMd) || !existsSync(handlerTs)) continue;

    const destDir = join(targetDir, entry);

    // Skip if already installed (preserve user edits)
    if (existsSync(destDir)) {
      installed.push(entry);
      continue;
    }

    mkdirSync(destDir, { recursive: true });
    writeFileSync(join(destDir, "SKILL.md"), readFileSync(skillMd));
    writeFileSync(join(destDir, "handler.ts"), readFileSync(handlerTs));
    installed.push(entry);
  }

  return installed;
}
