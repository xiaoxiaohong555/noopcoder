import { ShellTool } from "./shell-tool";

describe("ShellTool", () => {
  const tool = new ShellTool();

  test("echo hello returns success", async () => {
    const result = await tool.execute({ type: "shell", command: "echo hello" });
    expect(result.success).toBe(true);
    expect(result.output).toContain("hello");
  });

  test("nonexistent command returns failure", async () => {
    const result = await tool.execute({ type: "shell", command: "nonexistent_command_xyz_123" });
    expect(result.success).toBe(false);
    expect(result.output).toContain("命令执行失败");
  });

  test("changedCode is a boolean", async () => {
    const result = await tool.execute({ type: "shell", command: "echo test" });
    expect(typeof result.changedCode).toBe("boolean");
  });
});