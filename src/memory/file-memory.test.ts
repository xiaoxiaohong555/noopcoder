import { FileMemory } from "./file-memory";
import * as fs from "fs";
import * as path from "path";

describe("FileMemory", () => {
  const tmpDir = path.join(__dirname, "..", "..", "test-tmp-memory");

  beforeEach(() => { fs.mkdirSync(tmpDir, { recursive: true }); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  test("retrieve returns empty for empty memory", async () => {
    const memory = new FileMemory(tmpDir);
    const result = await memory.retrieve("fix bugs");
    expect(result).toBe("");
  });

  test("consolidate writes a file", async () => {
    const memory = new FileMemory(tmpDir);
    await memory.consolidate("goal: fix bug\nsummary: fixed the bug");
    const files = fs.readdirSync(tmpDir);
    expect(files.length).toBe(1);
  });
});