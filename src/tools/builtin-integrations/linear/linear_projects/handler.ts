import { safeExceptionError } from "../../api-helpers.js";

const API = "https://api.linear.app/graphql";

async function gql(token: string, query: string, variables?: any): Promise<any> {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear API error: ${res.status}`);
  const data = (await res.json()) as any;
  if (data.errors?.length) throw new Error(data.errors[0].message);
  return data.data;
}

export default async function (input: Record<string, unknown>): Promise<string> {
  const token = (globalThis as any).Zubo?.getSecret?.("linear_token");
  if (!token) return JSON.stringify({ error: "Linear token not configured. Use secret_set to store 'linear_token'." });

  const { action, project_id } = input as { action: string; project_id?: string };

  try {
    switch (action) {
      case "list": {
        const data = await gql(token, `{ projects(first: 25) { nodes { id name state progress startDate targetDate } } }`);
        return JSON.stringify(data.projects.nodes);
      }
      case "get": {
        if (!project_id) return JSON.stringify({ error: "project_id required" });
        const data = await gql(token, `query($id: String!) { project(id: $id) { id name description state progress startDate targetDate teams { nodes { name } } members { nodes { name } } } }`, { id: project_id });
        return JSON.stringify(data.project);
      }
      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    return safeExceptionError(err, "Linear");
  }
}
