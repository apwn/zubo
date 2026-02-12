import { searchRegistry, fetchRegistry } from "./client";
import { installFromRegistry } from "./installer";

export async function handleRegistrySearch(query: string): Promise<void> {
  console.log(`Searching registry for "${query}"...`);
  const results = await searchRegistry(query);
  if (results.length === 0) {
    console.log("No skills found matching your query.");
    return;
  }
  console.log(`\nFound ${results.length} skill(s):\n`);
  for (const entry of results) {
    console.log(`  ${entry.name} — ${entry.description}`);
    console.log(`    repo: ${entry.repo}  tags: ${entry.tags.join(", ")}`);
    if (entry.secrets?.length) {
      console.log(`    requires: ${entry.secrets.join(", ")}`);
    }
    console.log();
  }
}

export async function handleRegistryInstall(name: string): Promise<void> {
  console.log(`Installing skill "${name}" from registry...`);
  const result = await installFromRegistry(name);
  if (result.success) {
    console.log(`Installed "${name}" to ${result.path}`);
    if (result.requiredSecrets?.length) {
      console.log(`\nThis skill requires secrets: ${result.requiredSecrets.join(", ")}`);
      console.log("Use 'zubo start' and tell Zubo to set them, or use the dashboard.");
    }
  } else {
    console.error(`Failed: ${result.error}`);
  }
}

export async function handleRegistryPublish(name: string): Promise<void> {
  console.log(`Publishing skills is done via Pull Request to the zubo-skills/registry repo.`);
  console.log(`\nSteps:`);
  console.log(`1. Create a GitHub repo with your skill (SKILL.md + handler.ts)`);
  console.log(`2. Fork https://github.com/zubo-skills/registry`);
  console.log(`3. Add your skill entry to registry.json`);
  console.log(`4. Submit a Pull Request`);
}
