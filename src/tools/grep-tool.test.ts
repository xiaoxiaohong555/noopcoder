import { GrepTool } from "./grep-tool";

describe("GrepTool", () => {
  const tool = new GrepTool();

  test("changedCode is always false", async () => {
    const result = await tool.execute({ type: "grep", pattern: "test" });
    expect(result.changedCode).toBe(false);
  });

  test("returns success with output", async () => {
    const result = await tool.execute({ type: "grep", pattern: "test" });
    expect(result.success).toBe(true);
    expect(typeof result.output).toBe("string");
  });

  test("grep finds matching lines in files", async () => {
    const result = await tool.execute({ type: "grep", pattern: "describe", path: "src" });
    expect(result.success).toBe(true);
    expect(result.output).toContain("describe");
  });
});