import { ConfigLoader } from "./config-loader";
import * as fs from "fs";
import * as path from "path";

describe("ConfigLoader", () => {
  const tmpDir = path.join(__dirname, "..", "..", "test-tmp-config");

  beforeEach(() => { fs.mkdirSync(tmpDir, { recursive: true }); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  test("loads default config when no file", () => {
    const config = ConfigLoader.load(path.join(tmpDir, "nonexistent.json"));
    expect(config.llm.model).toBe("glm-5.2");
    expect(config.run.maxSteps).toBe(50);
  });

  test("merges user config overrides", () => {
    fs.writeFileSync(path.join(tmpDir, "custom.json"), JSON.stringify({ run: { maxSteps: 10 } }));
    const config = ConfigLoader.load(path.join(tmpDir, "custom.json"));
    expect(config.run.maxSteps).toBe(10);
    expect(config.llm.model).toBe("glm-5.2");
  });
});