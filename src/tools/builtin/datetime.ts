import { registerTool } from "../registry";

export function registerDatetimeTool() {
  registerTool({
    definition: {
      name: "get_current_datetime",
      description:
        "Get the current date and time in ISO format, with optional timezone.",
      input_schema: {
        type: "object",
        properties: {
          timezone: {
            type: "string",
            description:
              "IANA timezone (e.g. 'Europe/Berlin'). Defaults to UTC.",
          },
        },
        required: [],
      },
    },
    execute: async (input) => {
      const tz = (input.timezone as string) || "UTC";
      const now = new Date();
      const formatted = now.toLocaleString("en-US", {
        timeZone: tz,
        dateStyle: "full",
        timeStyle: "long",
      });
      return JSON.stringify({
        iso: now.toISOString(),
        formatted,
        timezone: tz,
      });
    },
  });
}
