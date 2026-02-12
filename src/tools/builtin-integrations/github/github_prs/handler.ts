const API = "https://api.github.com";

export default async function (input: Record<string, unknown>): Promise<string> {
  const token = (globalThis as any).Zubo?.getSecret?.("github_token");
  if (!token) {
    return JSON.stringify({
      error: "GitHub token not configured. Use secret_set to store a 'github_token' or connect_service to set up GitHub.",
    });
  }

  const { action, owner, repo, pr_number, title, body, head, base, event, state } = input as {
    action: string;
    owner: string;
    repo: string;
    pr_number?: number;
    title?: string;
    body?: string;
    head?: string;
    base?: string;
    event?: string;
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
        const res = await fetch(`${API}/repos/${owner}/${repo}/pulls?${qs}`, { headers });
        if (!res.ok) return JSON.stringify({ error: `GitHub API error: ${res.status} ${await res.text()}` });
        const prs = (await res.json()) as any[];
        return JSON.stringify(
          prs.map((p) => ({
            number: p.number,
            title: p.title,
            state: p.state,
            user: p.user?.login,
            head: p.head?.ref,
            base: p.base?.ref,
            created_at: p.created_at,
            url: p.html_url,
          }))
        );
      }

      case "create": {
        if (!title) return JSON.stringify({ error: "title is required for create" });
        if (!head) return JSON.stringify({ error: "head branch is required for create" });
        const res = await fetch(`${API}/repos/${owner}/${repo}/pulls`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ title, body: body || "", head, base: base || "main" }),
        });
        if (!res.ok) return JSON.stringify({ error: `GitHub API error: ${res.status} ${await res.text()}` });
        const pr = (await res.json()) as any;
        return JSON.stringify({ number: pr.number, title: pr.title, url: pr.html_url });
      }

      case "get": {
        if (!pr_number) return JSON.stringify({ error: "pr_number is required for get" });
        const res = await fetch(`${API}/repos/${owner}/${repo}/pulls/${pr_number}`, { headers });
        if (!res.ok) return JSON.stringify({ error: `GitHub API error: ${res.status} ${await res.text()}` });
        const pr = (await res.json()) as any;
        return JSON.stringify({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          body: pr.body,
          user: pr.user?.login,
          head: pr.head?.ref,
          base: pr.base?.ref,
          mergeable: pr.mergeable,
          merged: pr.merged,
          created_at: pr.created_at,
          url: pr.html_url,
        });
      }

      case "review": {
        if (!pr_number) return JSON.stringify({ error: "pr_number is required for review" });
        const res = await fetch(`${API}/repos/${owner}/${repo}/pulls/${pr_number}/reviews`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ body: body || "", event: event || "COMMENT" }),
        });
        if (!res.ok) return JSON.stringify({ error: `GitHub API error: ${res.status} ${await res.text()}` });
        const review = (await res.json()) as any;
        return JSON.stringify({ id: review.id, state: review.state, url: review.html_url });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: `Request failed: ${err.message}` });
  }
}
