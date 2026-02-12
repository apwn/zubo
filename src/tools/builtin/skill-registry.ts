import { registerTool } from "../registry";
import { searchRegistry } from "../../registry/client";
import { installFromRegistry } from "../../registry/installer";
import { loadSkills } from "../skill-loader";
import { paths } from "../../config/paths";

export function registerSkillRegistryTool() {
  registerTool({
    definition: {
      name: "skill_registry",
      description:
        "Search and install skills from the Zubo skill registry. Use action 'search' to find skills, 'install' to install one.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["search", "install"],
            description: "Action to perform",
          },
          query: {
            type: "string",
            description: "Search query (for action=search)",
          },
          name: {
            type: "string",
            description: "Skill name to install (for action=install)",
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
            tags: r.tags,
            secrets: r.secrets,
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
          } catch {}
          return JSON.stringify({
            installed: true,
            name: result.name,
            requiredSecrets: result.requiredSecrets,
          });
        }
        return JSON.stringify({ installed: false, error: result.error });
      }

      return JSON.stringify({ error: `Unknown action: ${action}` });
    },
  });
}
