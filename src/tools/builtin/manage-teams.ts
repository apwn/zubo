import { registerTool } from "../registry";
import { loadTeams, getTeam, createTeam, removeTeam, type AgentTeam } from "../../agent/teams";

export function registerManageTeamsTool() {
  registerTool({
    definition: {
      name: "manage_teams",
      description:
        "Create, list, view, and remove agent teams. Teams group agents together with an optional default workflow.",
      input_schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "list", "view", "remove"],
            description: "Action to perform",
          },
          name: {
            type: "string",
            description: "Team name",
          },
          description: {
            type: "string",
            description: "Team description (for create)",
          },
          agents: {
            type: "array",
            items: { type: "string" },
            description: "Agent names in the team (for create)",
          },
          default_workflow: {
            type: "string",
            description: "Default workflow for this team (for create)",
          },
        },
        required: ["action"],
      },
    },
    async execute(input) {
      const action = input.action as string;

      switch (action) {
        case "list": {
          const teams = loadTeams();
          if (teams.length === 0) return "No teams defined.";
          return JSON.stringify(
            teams.map((t) => ({
              name: t.name,
              description: t.description,
              agents: t.agents,
              defaultWorkflow: t.defaultWorkflow,
            }))
          );
        }

        case "view": {
          const name = input.name as string;
          if (!name) return JSON.stringify({ error: "name is required" });
          const team = getTeam(name);
          if (!team) return JSON.stringify({ error: `Team "${name}" not found` });
          return JSON.stringify(team);
        }

        case "create": {
          const name = input.name as string;
          if (!name) return JSON.stringify({ error: "name is required" });
          const team: AgentTeam = {
            name,
            description: (input.description as string) ?? "",
            agents: (input.agents as string[]) ?? [],
            defaultWorkflow: input.default_workflow as string | undefined,
          };
          const path = createTeam(team);
          return JSON.stringify({ created: true, name, path });
        }

        case "remove": {
          const name = input.name as string;
          if (!name) return JSON.stringify({ error: "name is required" });
          const removed = removeTeam(name);
          return JSON.stringify({ removed, name });
        }

        default:
          return JSON.stringify({ error: `Unknown action: ${action}` });
      }
    },
  });
}
