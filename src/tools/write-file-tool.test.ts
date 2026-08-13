import { WriteFileTool } from "./write-file-tool";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("WriteFileTool", () => {
  const tool = new WriteFileTool();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "noopcoder-test-"));

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("changedCode is true", async () => {
    const filePath = path.join(tmpDir, "test.ts");
    const result = await tool.execute({ type: "write_file", path: filePath, content: "hello" });
    expect(result.changedCode).toBe(true);
  });

  test("writes file content correctly", async () => {
    const filePath = path.join(tmpDir, "hello.txt");
    const result = await tool.execute({ type: "write_file", path: filePath, content: "hello world" });
    expect(result.success).toBe(true);
    expect(result.output).toContain("已写入");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toBe("hello world");
  });

  test("creates parent directories", async () => {
    const filePath = path.join(tmpDir, "deep", "nested", "file.txt");
    const result = await tool.execute({ type: "write_file", path: filePath, content: "nested" });
    expect(result.success).toBe(true);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("nested");
  });

  test("returns error for invalid path", async () => {
    // On Windows, use invalid characters like < > to trigger a write failure
    const result = await tool.execute({ type: "write_file", path: `${tmpDir}/<invalid>`, content: "test" });
    expect(result.success).toBe(false);
    expect(result.output).toContain("写入失败");
  });
});