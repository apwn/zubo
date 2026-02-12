import { describe, it, expect } from "bun:test";
import { safeApiError, safeExceptionError } from "../src/tools/builtin-integrations/api-helpers";

describe("Integration Helpers", () => {
  describe("safeApiError", () => {
    it("should return status code without leaking response body", async () => {
      const mockResponse = new Response("secret-token-leaked-here", {
        status: 401,
        statusText: "Unauthorized",
      });
      const result = await safeApiError(mockResponse, "TestService");
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain("TestService");
      expect(parsed.error).toContain("401");
      expect(parsed.error).not.toContain("secret-token");
    });

    it("should handle non-text responses gracefully", async () => {
      const mockResponse = new Response(null, { status: 500, statusText: "Internal Server Error" });
      const result = await safeApiError(mockResponse, "API");
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain("500");
    });
  });

  describe("safeExceptionError", () => {
    it("should not expose raw error messages", () => {
      const result = safeExceptionError(
        new Error("Connection refused to https://api.example.com?token=abc123"),
        "GitHub"
      );
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain("GitHub");
      expect(parsed.error).not.toContain("abc123");
      expect(parsed.error).toContain("Check logs");
    });
  });
});

describe("Integration Installer", () => {
  it("should have SERVICE_SECRETS for all builtin integrations", async () => {
    const { listAvailableIntegrations } = await import(
      "../src/tools/integration-installer"
    );
    const integrations = listAvailableIntegrations();

    // Each integration should have a secret_name
    for (const integration of integrations) {
      expect(integration.secret_name).toBeTruthy();
      expect(typeof integration.secret_name).toBe("string");
      expect(integration.skills.length).toBeGreaterThan(0);
    }
  });
});

describe("Jira SSRF Validation", () => {
  it("should block localhost URLs", async () => {
    // Mock the Zubo global to simulate Jira config
    (globalThis as any).Zubo = {
      getSecret: (name: string) => {
        if (name === "jira_token") return "fake-token";
        if (name === "jira_email") return "test@example.com";
        if (name === "jira_url") return "http://localhost:8080";
        return undefined;
      },
    };

    const handler = (await import("../src/tools/builtin-integrations/jira/jira_issues/handler")).default;
    const result = await handler({ action: "list" });
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeTruthy();
    // Should reject non-HTTPS or localhost
    expect(
      parsed.error.includes("HTTPS") || parsed.error.includes("internal")
    ).toBe(true);

    delete (globalThis as any).Zubo;
  });

  it("should block private IP ranges", async () => {
    (globalThis as any).Zubo = {
      getSecret: (name: string) => {
        if (name === "jira_token") return "fake-token";
        if (name === "jira_email") return "test@example.com";
        if (name === "jira_url") return "https://192.168.1.1";
        return undefined;
      },
    };

    const handler = (await import("../src/tools/builtin-integrations/jira/jira_issues/handler")).default;
    const result = await handler({ action: "list" });
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain("internal");

    delete (globalThis as any).Zubo;
  });
});
