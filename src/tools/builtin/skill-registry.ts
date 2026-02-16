import { registerTool } from "../registry";
import { searchRegistry } from "../../registry/client";
import { installFromRegistry } from "../../registry/installer";
import { loadSkills } from "../skill-loader";
import { paths } from "../../config/paths";
import { logger } from "../../util/logger";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const REGISTRY_API = process.env.ZUBO_REGISTRY_URL || "https://zubo.bot/api/registry";

export function registerSkillRegistryTool() {
  registerTool({
    definition: {
      name: "skill_registry",
      description:
        "Search, install, and publish skills from the Zubo skill registry. Use action 'search' to find skills, 'install' to install one, 'publish' to submit a local skill to the registry.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["search", "install", "publish"],
            description: "Action to perform",
          },
          query: {
            type: "string",
            description: "Search query (for action=search)",
          },
          name: {
            type: "string",
            description: "Skill name (for action=install or action=publish)",
          },
        },
        required: ["action"],
      },
    },
    async execute(input) {
      const action = input.action as string;

      if (action === "search") {
        const query = (input.query as string) ?? "";
        if (!query) return JSON.stringify({ error: "query is required for search" });
        const results = await searchRegistry(query);
        if (results.length === 0) return JSON.stringify({ results: [], message: "No skills found" });
        return JSON.stringify({
          results: results.map((r) => ({
            name: r.name,
            description: r.description,
            author: r.author_username,
            tags: r.tags,
            secrets: r.secrets,
            stars: r.stars_count,
            installs: r.install_count,
          })),
        });
      }

      if (action === "install") {
        const name = (input.name as string) ?? "";
        if (!name) return JSON.stringify({ error: "name is required for install" });
        const result = await installFromRegistry(name);
        if (result.success) {
          // Reload skills so the new skill is available immediately
          try {
            await loadSkills(paths.skills);
          } catch (err: any) {
            logger.warn("Failed to reload skills after install", { error: (err as Error).message });
          }
          return JSON.stringify({
            installed: true,
            name: result.name,
            requiredSecrets: result.requiredSecrets,
          });
        }
        return JSON.stringify({ installed: false, error: result.error });
      }

      if (action === "publish") {
        const name = (input.name as string) ?? "";
        if (!name) return JSON.stringify({ error: "name is required for publish" });

        const skillDir = join(paths.skills, name);
        const handlerPath = join(skillDir, "handler.ts");

        if (!existsSync(handlerPath)) {
          return JSON.stringify({ error: `Skill "${name}" not found at ${handlerPath}` });
        }

        const handlerCode = readFileSync(handlerPath, "utf-8");

        // Read optional SKILL.md
        const skillMdPath = join(skillDir, "SKILL.md");
        const skillMd = existsSync(skillMdPath) ? readFileSync(skillMdPath, "utf-8") : undefined;

        // Extract metadata from handler
        const nameMatch = handlerCode.match(/name:\s*["']([^"']+)["']/);
        const descMatch = handlerCode.match(/description:\s*["']([^"']+)["']/);
        const skillName = nameMatch?.[1] || name;
        const description = descMatch?.[1] || "";

        if (!description) {
          return JSON.stringify({ error: "Could not extract description from handler.ts. Ensure your skill exports a skill object with a description field." });
        }

        // Check for auth token
        const tokenPath = join(paths.root, "registry-token");
        if (!existsSync(tokenPath)) {
          return JSON.stringify({ error: "Publishing requires GitHub authentication. Visit the skills page to sign in with GitHub first." });
        }

        const sessionToken = readFileSync(tokenPath, "utf-8").trim();

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
            return JSON.stringify({ published: false, error: data.error });
          }

          const review = data.review;
          return JSON.stringify({
            published: true,
            name: skillName,
            status: review.status,
            risk_level: review.risk_level,
            findings: review.findings,
          });
        } catch (err: any) {
          return JSON.stringify({ published: false, error: `Network error: ${err.message}` });
        }
      }

      return JSON.stringify({ error: `Unknown action: ${action}` });
    },
  });
}
