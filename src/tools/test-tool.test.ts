import { TestTool } from "./test-tool";

describe("TestTool", () => {
  const tool = new TestTool();

  test("changedCode is always false", async () => {
    const result = await tool.execute({ type: "run_tests", target: "src/tools/tool-dispatcher.test.ts" });
    expect(result.changedCode).toBe(false);
  });

  test("runs tests with specific target and returns success", async () => {
    const result = await tool.execute({ type: "run_tests", target: "src/tools/tool-dispatcher.test.ts" });
    expect(result.success).toBe(true);
    expect(typeof result.output).toBe("string");
  });

  test("returns failure for nonexistent test file", async () => {
    const result = await tool.execute({ type: "run_tests", target: "nonexistent.test.ts" });
    expect(result.success).toBe(false);
  });
});