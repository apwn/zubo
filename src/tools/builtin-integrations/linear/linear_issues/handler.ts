function safeExceptionError(err: any, service: string): string {
  console.error(`[${service}] Request failed: ${err.message}`);
  return JSON.stringify({ error: `${service} request failed. Check logs for details.` });
}

const API = "https://api.linear.app/graphql";

async function gql(token: string, query: string, variables?: any): Promise<any> {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Linear API error: ${res.status}`);
  const data = (await res.json()) as any;
  if (data.errors?.length) throw new Error(data.errors[0].message);
  return data.data;
}

export default async function (input: Record<string, unknown>): Promise<string> {
  // Try OAuth token first, then fall back to API key
  let token: string | null = null;
  try {
    const { getOAuthTokenForIntegration } = await import("../../../oauth");
    token = await getOAuthTokenForIntegration("linear");
  } catch {}
  if (!token) {
    token = (globalThis as any).Zubo?.getSecret?.("linear_token") ?? null;
  }
  if (!token) return JSON.stringify({ error: "Linear is not connected. Use oauth_manage with provider 'linear' to connect via OAuth, or tell me your Linear API key and I'll set it up." });

  const { action, issue_id, title, description, team_id, query, assignee_id, priority } = input as {
    action: string; issue_id?: string; title?: string; description?: string;
    team_id?: string; query?: string; assignee_id?: string; priority?: number;
  };

  try {
    switch (action) {
      case "list": {
        const data = team_id
          ? await gql(token, `query($teamId: String!) { issues(first: 25, filter: { team: { id: { eq: $teamId } } }) { nodes { id identifier title state { name } assignee { name } priority createdAt } } }`, { teamId: team_id })
          : await gql(token, `{ issues(first: 25) { nodes { id identifier title state { name } assignee { name } priority createdAt } } }`);
        return JSON.stringify(data.issues.nodes);
      }
      case "create": {
        if (!title || !team_id) return JSON.stringify({ error: "title and team_id required" });
        const vars: any = { title, teamId: team_id };
        if (description) vars.description = description;
        if (assignee_id) vars.assigneeId = assignee_id;
        if (priority !== undefined) vars.priority = priority;
        const data = await gql(token, `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title url } } }`, { input: vars });
        return JSON.stringify(data.issueCreate.issue);
      }
      case "get": {
        if (!issue_id) return JSON.stringify({ error: "issue_id required" });
        const data = await gql(token, `query($id: String!) { issue(id: $id) { id identifier title description state { name } assignee { name } priority labels { nodes { name } } createdAt url } }`, { id: issue_id });
        return JSON.stringify(data.issue);
      }
      case "update": {
        if (!issue_id) return JSON.stringify({ error: "issue_id required" });
        const upd: any = {};
        if (title) upd.title = title;
        if (description) upd.description = description;
        if (assignee_id) upd.assigneeId = assignee_id;
        if (priority !== undefined) upd.priority = priority;
        const data = await gql(token, `mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { id identifier title } } }`, { id: issue_id, input: upd });
        return JSON.stringify(data.issueUpdate.issue);
      }
      case "search": {
        if (!query) return JSON.stringify({ error: "query required" });
        const data = await gql(token, `query($q: String!) { searchIssues(query: $q, first: 20) { nodes { id identifier title state { name } } } }`, { q: query });
        return JSON.stringify(data.searchIssues.nodes);
      }
      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    return safeExceptionError(err, "Linear");
  }
}
