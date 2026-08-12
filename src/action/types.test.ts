import { Action, ToolResult } from "./types";

describe("Action types", () => {
  test("GlobAction has correct shape", () => {
    const action: Action = { type: "glob", pattern: "**/*.ts" };
    expect(action.type).toBe("glob");
    expect((action as any).pattern).toBe("**/*.ts");
  });

  test("ShellAction has correct shape", () => {
    const action: Action = { type: "shell", command: "echo hello" };
    expect(action.type).toBe("shell");
  });

  test("DoneAction has correct shape", () => {
    const action: Action = { type: "done", summary: "finished" };
    expect(action.type).toBe("done");
  });

  test("ToolResult with changedCode", () => {
    const result: ToolResult = {
      success: true,
      output: "ok",
      action: { type: "write_file", path: "a.ts", content: "x" },
      changedCode: true,
    };
    expect(result.changedCode).toBe(true);
  });
});