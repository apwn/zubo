import { describe, it, expect } from "bun:test";
import { parseWorkflowMd } from "../src/agent/workflow";

describe("Workflow Parser", () => {
  it("should parse a valid workflow", () => {
    const md = `# research_pipeline
Automated research workflow

## Agents
- researcher
- writer

## Steps
### gather
- agent: researcher
- task: Research $input
- output: research_data

### write
- agent: writer
- task: Write report based on $research_data
- dependsOn: gather
- output: report
`;
    const def = parseWorkflowMd(md);
    expect(def).not.toBeNull();
    expect(def!.name).toBe("research_pipeline");
    expect(def!.agents).toEqual(["researcher", "writer"]);
    expect(def!.steps.length).toBe(2);
    expect(def!.steps[0].name).toBe("gather");
    expect(def!.steps[0].outputVar).toBe("research_data");
    expect(def!.steps[1].dependsOn).toEqual(["gather"]);
  });

  it("should return null for empty content", () => {
    expect(parseWorkflowMd("")).toBeNull();
  });
});
