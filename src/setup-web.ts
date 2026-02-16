import { configSchema } from "./config/schema";
import type { ProviderConfig } from "./config/schema";
import { createProvider, validateProvider } from "./llm/factory";
import { finalizeSetup, type SetupResult } from "./setup";
import { SETUP_WIZARD_HTML } from "./setup-web.html";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export async function runWebSetup() {
  let resolve: (result: SetupResult) => void;
  let reject: (err: Error) => void;
  const done = new Promise<SetupResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",

    async fetch(req) {
      const url = new URL(req.url);

      // ── Serve wizard HTML ──
      if (url.pathname === "/" && req.method === "GET") {
        return new Response(SETUP_WIZARD_HTML, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // ── API: Validate provider ──
      if (url.pathname === "/api/validate-provider" && req.method === "POST") {
        try {
          const body = await req.json() as { name: string; config: ProviderConfig };
          const testConfig = configSchema.parse({
            providers: { [body.name]: body.config },
            activeProvider: body.name,
          });
          const provider = await createProvider(testConfig);
          const err = await validateProvider(provider);
          if (err) return Response.json({ ok: false, error: err });
          return Response.json({ ok: true });
        } catch (e: any) {
          return Response.json({ ok: false, error: e.message ?? String(e) });
        }
      }

      // ── API: Detect local models (Ollama / LM Studio) ──
      if (url.pathname === "/api/detect-local" && req.method === "POST") {
        const body = await req.json() as { type: "ollama" | "lmstudio" };
        const results: { running: boolean; models: string[] } = { running: false, models: [] };

        if (body.type === "ollama") {
          // Check CLI
          const which = Bun.spawnSync(["which", "ollama"], { stdout: "pipe", stderr: "pipe" });
          const cliInstalled = which.exitCode === 0;

          try {
            const res = await fetch("http://localhost:11434/api/tags", {
              signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
              const data = await res.json() as { models?: { name: string }[] };
              results.running = true;
              results.models = (data.models ?? []).map((m) => m.name);
            }
          } catch {}
          return Response.json({ ...results, cliInstalled });
        }

        if (body.type === "lmstudio") {
          try {
            const res = await fetch("http://localhost:1234/v1/models", {
              signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
              const data = await res.json() as { data?: { id: string }[] };
              results.running = true;
              results.models = (data.data ?? []).map((m) => m.id);
            }
          } catch {}
          return Response.json(results);
        }

        return Response.json(results);
      }

      // ── API: Detect CLI tools (Claude Code / Codex) ──
      if (url.pathname === "/api/detect-cli" && req.method === "POST") {
        const body = await req.json() as { tool: "claude" | "codex" };
        const bin = body.tool === "claude" ? "claude" : "codex";
        const which = Bun.spawnSync(["which", bin], { stdout: "pipe", stderr: "pipe" });
        return Response.json({ installed: which.exitCode === 0 });
      }

      // ── API: Complete setup ──
      if (url.pathname === "/api/complete" && req.method === "POST") {
        try {
          const body = await req.json() as SetupResult;
          // Basic validation
          if (!body.providers || !body.activeProvider) {
            return Response.json({ ok: false, error: "Missing provider configuration" });
          }
          resolve!(body);
          return Response.json({ ok: true });
        } catch (e: any) {
          return Response.json({ ok: false, error: e.message ?? String(e) });
        }
      }

      return new Response("Not found", { status: 404 });
    },
  });

  const port = server.port;
  const url = `http://localhost:${port}`;

  // Auto-open in browser
  const platform = process.platform;
  if (platform === "darwin") {
    Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
  } else if (platform === "linux") {
    Bun.spawn(["xdg-open", url], { stdout: "ignore", stderr: "ignore" });
  } else if (platform === "win32") {
    Bun.spawn(["cmd", "/c", "start", url], { stdout: "ignore", stderr: "ignore" });
  }

  console.log("");
  console.log(`  ${CYAN}→${RESET} Setup wizard opened at ${BOLD}${url}${RESET}`);
  console.log(`  ${DIM}  Waiting for setup to complete in the browser...${RESET}`);
  console.log(`  ${DIM}  Press Ctrl+C to cancel.${RESET}`);
  console.log("");

  // Timeout
  const timer = setTimeout(() => {
    reject!(new Error("Setup timed out after 30 minutes"));
  }, TIMEOUT_MS);

  // SIGINT handler
  const cleanup = () => {
    clearTimeout(timer);
    server.stop();
  };
  process.on("SIGINT", () => {
    cleanup();
    console.log(`\n  ${YELLOW}!${RESET} Setup cancelled.\n`);
    process.exit(0);
  });

  try {
    const result = await done;
    cleanup();
    await finalizeSetup(result);
  } catch (err: any) {
    cleanup();
    console.log(`  ${YELLOW}!${RESET} ${err.message}\n`);
    process.exit(1);
  }
}
