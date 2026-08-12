import { ToolDispatcher } from "./tool-dispatcher";
import { Tool } from "./types";
import { Action } from "../action/types";

describe("ToolDispatcher", () => {
  test("dispatches to registered tool", async () => {
    const mockTool: Tool = {
      name: "glob",
      description: "Find files",
      parameters: { pattern: { type: "string", description: "Glob pattern", required: true } },
      execute: async (action) => ({
        success: true, output: "a.ts\nb.ts", action, changedCode: false,
      }),
    };
    const dispatcher = new ToolDispatcher();
    dispatcher.register(mockTool);
    const action: Action = { type: "glob", pattern: "*.ts" };
    const result = await dispatcher.execute(action);
    expect(result.success).toBe(true);
    expect(result.output).toBe("a.ts\nb.ts");
  });

  test("throws for unregistered tool", async () => {
    const dispatcher = new ToolDispatcher();
    const action: Action = { type: "glob", pattern: "*.ts" };
    await expect(dispatcher.execute(action)).rejects.toThrow("未注册的工具");
  });
});