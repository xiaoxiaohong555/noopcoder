import { ReadFileTool } from "./read-file-tool";
import * as fs from "fs";
import * as path from "path";

describe("ReadFileTool", () => {
  const tool = new ReadFileTool();

  test("changedCode is always false", async () => {
    const result = await tool.execute({ type: "read_file", path: "package.json" });
    expect(result.changedCode).toBe(false);
  });

  test("reads existing file and returns content", async () => {
    const result = await tool.execute({ type: "read_file", path: "package.json" });
    expect(result.success).toBe(true);
    expect(result.output).toContain("noopcoder");
  });

  test("returns error for nonexistent file", async () => {
    const result = await tool.execute({ type: "read_file", path: "nonexistent.txt" });
    expect(result.success).toBe(false);
    expect(result.output).toContain("读取文件失败");
  });
});