import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { readFileSync as realReadFileSync } from "node:fs";

/**
 * Tests for the web-search handler.
 *
 * The handler reads a Brave API key from ~/.zubo/secrets.json via
 * fs.readFileSync, tries Brave Search first, and falls back to DuckDuckGo
 * HTML scraping on failure. Since it makes real network calls, we mock
 * `globalThis.fetch` and use `mock.module` for `fs` to avoid external
 * requests and filesystem dependencies.
 */

// ── Mutable readFileSync delegate ────────────────────────────────────────────
// mock.module replaces `fs` before the handler is imported. The mock delegates
// to `readFileSyncFn`, which tests swap out via `setReadFileSyncImpl`.

let readFileSyncFn: (...args: any[]) => any = realReadFileSync;

function setReadFileSyncImpl(fn: (...args: any[]) => any) {
  readFileSyncFn = fn;
}

function resetReadFileSyncImpl() {
  readFileSyncFn = realReadFileSync;
}

// Replace the "fs" module with a proxy that intercepts readFileSync but
// passes everything else through to the real module.
mock.module("fs", () => {
  const real = require("node:fs");
  return {
    ...real,
    readFileSync: (...args: any[]) => readFileSyncFn(...args),
  };
});

// ── Import the handler after the mock is installed ───────────────────────────

const { default: handler } = await import(
  "../src/tools/builtin-skills/web-search/handler"
);

// ── Fetch mock infrastructure ────────────────────────────────────────────────

const originalFetch = globalThis.fetch;
let mockFetchImpl: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

function installFetchMock(
  impl: (url: string | URL | Request, init?: RequestInit) => Promise<Response>,
) {
  mockFetchImpl = impl;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    return mockFetchImpl(input, init);
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// ── Brave API mock response factory ──────────────────────────────────────────

function makeBraveResponse(results: { title: string; url: string; description: string }[]) {
  return new Response(
    JSON.stringify({
      web: { results },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ── DuckDuckGo HTML mock response factory ────────────────────────────────────

function makeDdgHtml(results: { url: string; title: string; snippet: string }[]) {
  const items = results
    .map(
      (r) =>
        `<a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(r.url)}&amp;rut=abc">${r.title}</a>
         <a class="result__snippet" href="#">${r.snippet}</a>`,
    )
    .join("\n");
  return new Response(items, { status: 200, headers: { "Content-Type": "text/html" } });
}

// ── Test suites ──────────────────────────────────────────────────────────────

describe("web-search: Brave API success path", () => {
  beforeEach(() => {
    setReadFileSyncImpl(() => JSON.stringify({ BRAVE_API_KEY: "test-brave-key" }));

    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("api.search.brave.com")) {
        return makeBraveResponse([
          { title: "Brave Result 1", url: "https://example.com/1", description: "Snippet one" },
          { title: "Brave Result 2", url: "https://example.com/2", description: "Snippet two" },
        ]);
      }
      return new Response("Not found", { status: 404 });
    });
  });

  afterEach(() => {
    restoreFetch();
    resetReadFileSyncImpl();
  });

  test("returns valid JSON with query and results array", async () => {
    const raw = await handler({ query: "bun runtime" });
    const parsed = JSON.parse(raw);

    expect(parsed.query).toBe("bun runtime");
    expect(Array.isArray(parsed.results)).toBe(true);
    expect(parsed.results.length).toBe(2);
  });

  test("results have title, url, snippet fields", async () => {
    const raw = await handler({ query: "bun runtime" });
    const parsed = JSON.parse(raw);

    for (const result of parsed.results) {
      expect(typeof result.title).toBe("string");
      expect(typeof result.url).toBe("string");
      expect(typeof result.snippet).toBe("string");
    }
  });

  test("results contain expected data from Brave response", async () => {
    const raw = await handler({ query: "bun runtime" });
    const parsed = JSON.parse(raw);

    expect(parsed.results[0].title).toBe("Brave Result 1");
    expect(parsed.results[0].url).toBe("https://example.com/1");
    expect(parsed.results[0].snippet).toBe("Snippet one");
  });

  test("passes maxResults to the Brave API URL", async () => {
    let capturedUrl = "";
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      capturedUrl = urlStr;
      if (urlStr.includes("api.search.brave.com")) {
        return makeBraveResponse([]);
      }
      return new Response("Not found", { status: 404 });
    });

    await handler({ query: "test", maxResults: 10 });

    expect(capturedUrl).toContain("count=10");
  });

  test("sends Brave API key in X-Subscription-Token header", async () => {
    let capturedHeaders: HeadersInit | undefined;
    installFetchMock(async (url, init) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("api.search.brave.com")) {
        capturedHeaders = init?.headers;
        return makeBraveResponse([]);
      }
      return new Response("Not found", { status: 404 });
    });

    await handler({ query: "test" });

    expect(capturedHeaders).toBeDefined();
    expect((capturedHeaders as Record<string, string>)["X-Subscription-Token"]).toBe(
      "test-brave-key",
    );
  });
});

// ── maxResults default ───────────────────────────────────────────────────────

describe("web-search: maxResults default", () => {
  beforeEach(() => {
    setReadFileSyncImpl(() => JSON.stringify({ BRAVE_API_KEY: "key" }));
  });

  afterEach(() => {
    restoreFetch();
    resetReadFileSyncImpl();
  });

  test("defaults maxResults to 5 when not provided", async () => {
    let capturedUrl = "";
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      capturedUrl = urlStr;
      if (urlStr.includes("api.search.brave.com")) {
        return makeBraveResponse([]);
      }
      return new Response("Not found", { status: 404 });
    });

    await handler({ query: "test" });

    expect(capturedUrl).toContain("count=5");
  });

  test("respects custom maxResults value", async () => {
    let capturedUrl = "";
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      capturedUrl = urlStr;
      if (urlStr.includes("api.search.brave.com")) {
        return makeBraveResponse([]);
      }
      return new Response("Not found", { status: 404 });
    });

    await handler({ query: "test", maxResults: 3 });

    expect(capturedUrl).toContain("count=3");
  });
});

// ── Empty results ────────────────────────────────────────────────────────────

describe("web-search: empty results", () => {
  beforeEach(() => {
    setReadFileSyncImpl(() => JSON.stringify({ BRAVE_API_KEY: "key" }));
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("api.search.brave.com")) {
        return makeBraveResponse([]);
      }
      return new Response("Not found", { status: 404 });
    });
  });

  afterEach(() => {
    restoreFetch();
    resetReadFileSyncImpl();
  });

  test("returns message when Brave returns no results", async () => {
    const raw = await handler({ query: "xyzzy_nothing_here" });
    const parsed = JSON.parse(raw);

    expect(parsed.query).toBe("xyzzy_nothing_here");
    expect(parsed.results).toEqual([]);
    expect(parsed.message).toBe("No results found.");
  });

  test("returns message when DDG returns no results (no Brave key)", async () => {
    // No Brave key -> falls to DDG
    setReadFileSyncImpl(() => {
      throw new Error("file not found");
    });
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("duckduckgo.com")) {
        return new Response("<html><body>No results</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }
      return new Response("Not found", { status: 404 });
    });

    const raw = await handler({ query: "xyzzy_nothing" });
    const parsed = JSON.parse(raw);

    expect(parsed.results).toEqual([]);
    expect(parsed.message).toBe("No results found.");
  });
});

// ── Brave failure falls through to DuckDuckGo ───────────────────────────────

describe("web-search: Brave failure fallback to DuckDuckGo", () => {
  beforeEach(() => {
    // Brave key exists, but Brave API will fail
    setReadFileSyncImpl(() => JSON.stringify({ BRAVE_API_KEY: "key" }));
  });

  afterEach(() => {
    restoreFetch();
    resetReadFileSyncImpl();
  });

  test("falls back to DuckDuckGo when Brave returns HTTP error", async () => {
    let ddgCalled = false;

    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("api.search.brave.com")) {
        return new Response("Internal Server Error", { status: 500 });
      }
      if (urlStr.includes("duckduckgo.com")) {
        ddgCalled = true;
        return makeDdgHtml([
          { url: "https://ddg.example.com/1", title: "DDG Result", snippet: "DDG Snippet" },
        ]);
      }
      return new Response("Not found", { status: 404 });
    });

    const raw = await handler({ query: "test fallback" });
    const parsed = JSON.parse(raw);

    expect(ddgCalled).toBe(true);
    expect(parsed.query).toBe("test fallback");
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results[0].title).toBe("DDG Result");
  });

  test("falls back to DuckDuckGo when Brave fetch throws", async () => {
    let ddgCalled = false;

    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("api.search.brave.com")) {
        throw new Error("Network error");
      }
      if (urlStr.includes("duckduckgo.com")) {
        ddgCalled = true;
        return makeDdgHtml([
          { url: "https://fallback.example.com", title: "Fallback Title", snippet: "Fallback snippet" },
        ]);
      }
      return new Response("Not found", { status: 404 });
    });

    const raw = await handler({ query: "test network error" });
    const parsed = JSON.parse(raw);

    expect(ddgCalled).toBe(true);
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results[0].title).toBe("Fallback Title");
  });
});

// ── DuckDuckGo fallback (no Brave key) ───────────────────────────────────────

describe("web-search: DuckDuckGo fallback when no Brave key", () => {
  beforeEach(() => {
    // No Brave key -> handler goes straight to DDG
    setReadFileSyncImpl(() => {
      throw new Error("ENOENT: no such file or directory");
    });
  });

  afterEach(() => {
    restoreFetch();
    resetReadFileSyncImpl();
  });

  test("uses DuckDuckGo when no Brave API key exists", async () => {
    let braveCalled = false;
    let ddgCalled = false;

    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("api.search.brave.com")) {
        braveCalled = true;
      }
      if (urlStr.includes("duckduckgo.com")) {
        ddgCalled = true;
        return makeDdgHtml([
          { url: "https://ddg.example.com/a", title: "DDG Only", snippet: "Only DDG" },
        ]);
      }
      return new Response("Not found", { status: 404 });
    });

    const raw = await handler({ query: "ddg only test" });
    const parsed = JSON.parse(raw);

    expect(braveCalled).toBe(false);
    expect(ddgCalled).toBe(true);
    expect(parsed.results[0].title).toBe("DDG Only");
  });

  test("DuckDuckGo results have correct fields", async () => {
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("duckduckgo.com")) {
        return makeDdgHtml([
          { url: "https://example.com/page", title: "Page Title", snippet: "Page description text" },
          { url: "https://example.com/other", title: "Other Title", snippet: "Other description" },
        ]);
      }
      return new Response("Not found", { status: 404 });
    });

    const raw = await handler({ query: "ddg fields" });
    const parsed = JSON.parse(raw);

    expect(parsed.results.length).toBe(2);
    for (const result of parsed.results) {
      expect(typeof result.title).toBe("string");
      expect(typeof result.url).toBe("string");
      expect(typeof result.snippet).toBe("string");
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.url.length).toBeGreaterThan(0);
    }
  });

  test("DuckDuckGo extracts the real URL from uddg parameter", async () => {
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("duckduckgo.com")) {
        return makeDdgHtml([
          { url: "https://real-site.example.com/page", title: "Real URL", snippet: "Desc" },
        ]);
      }
      return new Response("Not found", { status: 404 });
    });

    const raw = await handler({ query: "url extraction" });
    const parsed = JSON.parse(raw);

    expect(parsed.results[0].url).toBe("https://real-site.example.com/page");
  });

  test("DuckDuckGo respects maxResults limit", async () => {
    const manyResults = Array.from({ length: 10 }, (_, i) => ({
      url: `https://example.com/${i}`,
      title: `Title ${i}`,
      snippet: `Snippet ${i}`,
    }));

    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("duckduckgo.com")) {
        return makeDdgHtml(manyResults);
      }
      return new Response("Not found", { status: 404 });
    });

    const raw = await handler({ query: "limit test", maxResults: 3 });
    const parsed = JSON.parse(raw);

    expect(parsed.results.length).toBeLessThanOrEqual(3);
  });
});

// ── loadBraveApiKey behavior ─────────────────────────────────────────────────

describe("web-search: loadBraveApiKey", () => {
  afterEach(() => {
    restoreFetch();
    resetReadFileSyncImpl();
  });

  test("returns null when secrets file does not exist (skips Brave)", async () => {
    setReadFileSyncImpl(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    let braveCalled = false;
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("api.search.brave.com")) {
        braveCalled = true;
      }
      if (urlStr.includes("duckduckgo.com")) {
        return makeDdgHtml([
          { url: "https://example.com", title: "Fallback", snippet: "Works" },
        ]);
      }
      return new Response("Not found", { status: 404 });
    });

    await handler({ query: "no secrets file" });

    // If loadBraveApiKey returns null, the handler skips Brave entirely
    expect(braveCalled).toBe(false);
  });

  test("returns null when secrets file has no BRAVE_API_KEY field (skips Brave)", async () => {
    setReadFileSyncImpl(() => JSON.stringify({ OTHER_KEY: "value" }));

    let braveCalled = false;
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("api.search.brave.com")) {
        braveCalled = true;
      }
      if (urlStr.includes("duckduckgo.com")) {
        return makeDdgHtml([
          { url: "https://example.com", title: "No Key", snippet: "Desc" },
        ]);
      }
      return new Response("Not found", { status: 404 });
    });

    await handler({ query: "no brave key in secrets" });

    expect(braveCalled).toBe(false);
  });

  test("returns null when secrets file contains invalid JSON (skips Brave)", async () => {
    setReadFileSyncImpl(() => "this is not json{{{");

    let braveCalled = false;
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("api.search.brave.com")) {
        braveCalled = true;
      }
      if (urlStr.includes("duckduckgo.com")) {
        return makeDdgHtml([
          { url: "https://example.com", title: "Bad JSON", snippet: "Desc" },
        ]);
      }
      return new Response("Not found", { status: 404 });
    });

    await handler({ query: "bad json secrets" });

    expect(braveCalled).toBe(false);
  });
});

// ── DuckDuckGo failure ───────────────────────────────────────────────────────

describe("web-search: DuckDuckGo failure", () => {
  afterEach(() => {
    restoreFetch();
    resetReadFileSyncImpl();
  });

  test("throws when DuckDuckGo also fails (no Brave key)", async () => {
    setReadFileSyncImpl(() => {
      throw new Error("ENOENT");
    });
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("duckduckgo.com")) {
        return new Response("Service Unavailable", { status: 503 });
      }
      return new Response("Not found", { status: 404 });
    });

    expect(handler({ query: "total failure" })).rejects.toThrow();
  });

  test("throws when both Brave and DuckDuckGo fail", async () => {
    setReadFileSyncImpl(() => JSON.stringify({ BRAVE_API_KEY: "key" }));
    installFetchMock(async (url) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("api.search.brave.com")) {
        return new Response("Bad Gateway", { status: 502 });
      }
      if (urlStr.includes("duckduckgo.com")) {
        return new Response("Service Unavailable", { status: 503 });
      }
      return new Response("Not found", { status: 404 });
    });

    expect(handler({ query: "both fail" })).rejects.toThrow();
  });
});
