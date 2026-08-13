import { execSync } from "child_process";
import { Tool } from "./types";
import { Action, ToolResult } from "../action/types";

export class ShellTool implements Tool {
  name = "shell";
  description = "Execute a shell command";
  parameters = {
    command: { type: "string", description: "Shell command to run", required: true },
  };
  private timeoutMs = 30000;

  execute(action: Action): Promise<ToolResult> {
    return new Promise((resolve) => {
      const a = action as any;
      try {
        const output = execSync(a.command, {
          timeout: this.timeoutMs, encoding: "utf-8", maxBuffer: 1024 * 1024, cwd: process.cwd(),
        });
        const changedCode = this.detectWorkspaceChange();
        resolve({ success: true, output: output || "(executed successfully)", action, changedCode });
      } catch (err: any) {
        const msg = err.stderr || err.message || "unknown error";
        resolve({ success: false, output: `命令执行失败: ${msg}`, action, changedCode: false, error: msg });
      }
    });
  }

  private detectWorkspaceChange(): boolean {
    try {
      const diff = execSync("git diff --name-only", { encoding: "utf-8", timeout: 5000 });
      return diff.trim().length > 0;
    } catch { return false; }
  }
}