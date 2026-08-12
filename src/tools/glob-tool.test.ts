import { GlobTool } from "./glob-tool";
import * as fs from "fs";
import * as path from "path";

describe("GlobTool", () => {
  const tool = new GlobTool();

  test("changedCode is always false", async () => {
    const result = await tool.execute({ type: "glob", pattern: "*.ts" });
    expect(result.changedCode).toBe(false);
  });

  test("returns success with output for any pattern", async () => {
    const result = await tool.execute({ type: "glob", pattern: "*.ts" });
    expect(result.success).toBe(true);
    expect(typeof result.output).toBe("string");
    expect(result.output.length).toBeGreaterThan(0);
  });

  test("returns (no files matched) when no files match", async () => {
    const result = await tool.execute({ type: "glob", pattern: "nonexistent.xyz" });
    expect(result.success).toBe(true);
    expect(result.output).toBe("(no files matched)");
  });
});