import { searchRegistry } from "./client";
import { installFromRegistry } from "./installer";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { paths } from "../config/paths";

const REGISTRY_API = process.env.ZUBO_REGISTRY_URL || "https://skills.zubo.bot/api/registry";

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
    console.log(`    by: ${entry.author_username}  stars: ${entry.stars_count}  installs: ${entry.install_count}`);
    if (entry.tags?.length) {
      console.log(`    tags: ${entry.tags.join(", ")}`);
    }
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
  // Read handler.ts from the skill directory
  const skillDir = join(paths.skills, name);
  const handlerPath = join(skillDir, "handler.ts");

  if (!existsSync(handlerPath)) {
    console.error(`Skill "${name}" not found at ${handlerPath}`);
    console.log(`\nMake sure you have a skill at ~/.zubo/workspace/skills/${name}/handler.ts`);
    return;
  }

  const handlerCode = readFileSync(handlerPath, "utf-8");

  // Read SKILL.md if it exists
  const skillMdPath = join(skillDir, "SKILL.md");
  const skillMd = existsSync(skillMdPath) ? readFileSync(skillMdPath, "utf-8") : undefined;

  // Try to extract metadata from the handler
  const nameMatch = handlerCode.match(/name:\s*["']([^"']+)["']/);
  const descMatch = handlerCode.match(/description:\s*["']([^"']+)["']/);

  const skillName = nameMatch?.[1] || name;
  const description = descMatch?.[1] || "";

  if (!description) {
    console.error("Could not extract description from handler.ts. Make sure your skill exports a `skill` object with a `description` field.");
    return;
  }

  // Check for auth token
  const tokenPath = join(paths.root, "registry-token");
  if (!existsSync(tokenPath)) {
    console.log("Publishing requires GitHub authentication.");
    console.log(`\nTo authenticate:`);
    console.log(`  1. Visit ${REGISTRY_API.replace('/api/registry', '')}/skills.html`);
    console.log(`  2. Sign in with GitHub`);
    console.log(`  3. Your session will be used for CLI publishing`);
    console.log(`\nAlternatively, submit via the web form at ${REGISTRY_API.replace('/api/registry', '')}/skills.html#submit`);
    return;
  }

  const sessionToken = readFileSync(tokenPath, "utf-8").trim();

  console.log(`Publishing "${skillName}" to the registry...`);

  try {
    const res = await fetch(`${REGISTRY_API}/skills`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `zubo_session=${sessionToken}`,
      },
      body: JSON.stringify({
        name: skillName,
        description,
        handler_code: handlerCode,
        skill_md: skillMd,
      }),
    });

    const data = (await res.json()) as any;

    if (!res.ok) {
      console.error(`Failed: ${data.error}`);
      return;
    }

    const review = data.review;
    console.log(`\nSubmitted "${skillName}" successfully!`);
    console.log(`Status: ${review.status} (risk level: ${review.risk_level})`);

    if (review.findings?.length) {
      console.log("\nReview findings:");
      for (const f of review.findings) {
        console.log(`  Line ${f.line}: ${f.description} [${f.severity}]`);
      }
    }

    if (review.status === "approved") {
      console.log("\nYour skill is live! Others can install it with:");
      console.log(`  zubo install ${skillName}`);
    } else if (review.status === "flagged") {
      console.log("\nYour skill is under review. It will appear once approved.");
    } else {
      console.log("\nYour skill was rejected due to security concerns. Review the findings above.");
    }
  } catch (err: any) {
    console.error(`Network error: ${err.message}`);
  }
}
