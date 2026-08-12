import { execSync } from "child_process";
import { Tool } from "./types";
import { Action, ToolResult } from "../action/types";

export class TestTool implements Tool {
  name = "run_tests";
  description = "Run the project's test suite";
  parameters = {
    target: { type: "string", description: "Specific test file or pattern to run" },
  };

  async execute(action: Action): Promise<ToolResult> {
    const a = action as any;
    const cmd = a.target ? `npx jest ${a.target}` : "npm test";
    try {
      const output = execSync(cmd, { encoding: "utf-8", timeout: 120000, maxBuffer: 1024 * 1024 });
      return { success: true, output, action, changedCode: false };
    } catch (err: any) {
      const output = err.stdout || err.stderr || err.message || "";
      return { success: false, output, action, changedCode: false, error: output };
    }
  }
}