const API = "https://api.github.com";

export default async function (input: Record<string, unknown>): Promise<string> {
  const token = (globalThis as any).Zubo?.getSecret?.("github_token");
  if (!token) {
    return JSON.stringify({
      error: "GitHub token not configured. Use secret_set to store a 'github_token' or connect_service to set up GitHub.",
    });
  }

  const { action, owner, repo, type, sort } = input as {
    action: string;
    owner?: string;
    repo?: string;
    type?: string;
    sort?: string;
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "Zubo-Agent",
  };

  try {
    switch (action) {
      case "list": {
        const endpoint = owner ? `${API}/users/${owner}/repos` : `${API}/user/repos`;
        const qs = new URLSearchParams({
          type: type || "owner",
          sort: sort || "updated",
          per_page: "30",
        });
        const res = await fetch(`${endpoint}?${qs}`, { headers });
        if (!res.ok) return JSON.stringify({ error: `GitHub API error: ${res.status} ${await res.text()}` });
        const repos = (await res.json()) as any[];
        return JSON.stringify(
          repos.map((r) => ({
            full_name: r.full_name,
            description: r.description,
            language: r.language,
            stars: r.stargazers_count,
            forks: r.forks_count,
            private: r.private,
            updated_at: r.updated_at,
            url: r.html_url,
          }))
        );
      }

      case "get": {
        if (!owner || !repo) return JSON.stringify({ error: "owner and repo are required for get" });
        const res = await fetch(`${API}/repos/${owner}/${repo}`, { headers });
        if (!res.ok) return JSON.stringify({ error: `GitHub API error: ${res.status} ${await res.text()}` });
        const r = (await res.json()) as any;
        return JSON.stringify({
          full_name: r.full_name,
          description: r.description,
          language: r.language,
          stars: r.stargazers_count,
          forks: r.forks_count,
          open_issues: r.open_issues_count,
          private: r.private,
          default_branch: r.default_branch,
          created_at: r.created_at,
          updated_at: r.updated_at,
          url: r.html_url,
        });
      }

      default:
        return JSON.stringify({ error: `Unknown action: ${action}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: `Request failed: ${err.message}` });
  }
}
