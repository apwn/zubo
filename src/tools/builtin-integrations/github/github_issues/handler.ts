import { safeApiError, safeExceptionError } from "../../api-helpers.js";

const API = "https://api.github.com";

export default async function (input: Record<string, unknown>): Promise<string> {
  const token = (globalThis as any).Zubo?.getSecret?.("github_token");
  if (!token) {
    return JSON.stringify({
      error: "GitHub token not configured. Use secret_set to store a 'github_token' or connect_service to set up GitHub.",
    });
  }

  const { action, owner, repo, issue_number, title, body, labels, state } = input as {
    action: string;
    owner: string;
    repo: string;
    issue_number?: number;
    title?: string;
    body?: string;
    labels?: string[];
    state?: string;
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "Zubo-Agent",
  };

  try {
    switch (action) {
      case "list": {
        const qs = new URLSearchParams({ state: state || "open", per_page: "30" });
        const res = await fetch(`${API}/repos/${owner}/${repo}/issues?${qs}`, { headers });
        if (!res.ok) return await safeApiError(res, "GitHub");
        const issues = (await res.json()) as any[];
        return JSON.stringify(
          issues.map((i) => ({
            number: i.number,
            title: i.title,
            state: i.state,
            user: i.user?.login,
            labels: i.labels?.map((l: any) => l.name),
            created_at: i.created_at,
            comments: i.comments,
          }))
        );
      }

      case "create": {
        if (!title) return JSON.stringify({ error: "title is required for create" });
        const res = await fetch(`${API}/repos/${owner}/${repo}/issues`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ title, body: body || "", labels: labels || [] }),
        });
        if (!res.ok) return await safeApiError(res, "GitHub");
        const issue = (await res.json()) as any;
        return JSON.stringify({ number: issue.number, title: issue.title, url: issue.html_url });
      }

      case "get": {
        if (!issue_number) return JSON.stringify({ error: "issue_number is required for get" });
        const res = await fetch(`${API}/repos/${owner}/${repo}/issues/${issue_number}`, { headers });
        if (!res.ok) return await safeApiError(res, "GitHub");
        const issue = (await res.json()) as any;
        return JSON.stringify({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          body: issue.body,
          user: issue.user?.login,
          labels: issue.labels?.map((l: any) => l.name),
          created_at: issue.created_at,
          comments: issue.comments,
          url: issue.html_url,
        });
      }

      case "comment": {
        if (!issue_number) return JSON.stringify({ error: "issue_number is required for comment" });
        if (!body) return JSON.stringify({ error: "body is required for comment" });
        const res = await fetch(`${API}/repos/${owner}/${repo}/issues/${issue_number}/comments`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
        if (!res.ok) return await safeApiError(res, "GitHub");
        const comment = (await res.json()) as any;
        return JSON.stringify({ id: comment.id, url: comment.html_url, created_at: comment.created_at });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    return safeExceptionError(err, "GitHub");
  }
}
