import { describe, it, expect } from "bun:test";
import { parseSkillMd } from "../src/tools/skill-loader";

describe("Skill Loader", () => {
  it("should parse a valid SKILL.md", () => {
    const md = `# my_skill

A test skill that does things.

## Input Schema

\`\`\`json
{
  "type": "object",
  "properties": {
    "action": { "type": "string" }
  },
  "required": ["action"]
}
\`\`\`

## Usage Hints

- Use action "test" to test.
`;
    const result = parseSkillMd(md, "/tmp/test");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("my_skill");
    expect(result!.description).toContain("test skill");
  });

  it("should return null for empty content", () => {
    const result = parseSkillMd("", "/tmp/test");
    expect(result).toBeNull();
  });

  it("should handle missing schema gracefully", () => {
    const md = "# my_skill\nA skill without a schema.";
    const result = parseSkillMd(md, "/tmp/test");
    // Should still parse the name and description
    expect(result).not.toBeNull();
    expect(result!.name).toBe("my_skill");
  });
});
