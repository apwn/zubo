import { describe, it, expect } from "bun:test";
import { getToolPermission } from "../src/tools/permissions";

describe("getToolPermission", () => {
  it("returns 'auto' for safe built-in tools", () => {
    expect(getToolPermission("datetime")).toBe("auto");
    expect(getToolPermission("memory_write")).toBe("auto");
    expect(getToolPermission("memory_search")).toBe("auto");
    expect(getToolPermission("cron_list")).toBe("auto");
  });

  it("returns 'confirm' for dangerous tools", () => {
    expect(getToolPermission("shell")).toBe("confirm");
    expect(getToolPermission("file_write")).toBe("confirm");
  });

  it("returns 'auto' for unknown tools (user-installed skills)", () => {
    expect(getToolPermission("my_custom_skill")).toBe("auto");
    expect(getToolPermission("weather")).toBe("auto");
  });
});
