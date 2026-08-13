import * as path from "path";
import { SandboxPolicy, GuardResult } from "./types";
import { Action } from "../action/types";

export class SandboxGuard {
  constructor(private policy: SandboxPolicy) {}

  check(action: Action): GuardResult {
    if ("path" in action) {
      const filePath = (action as any).path as string;
      if (filePath) {
        const result = this.checkPath(filePath);
        if (result) return result;
      }
    }
    if (action.type === "shell") {
      const command = (action as any).command as string;
      if (command) {
        const result = this.checkCommand(command);
        if (result) return result;
      }
    }
    return { verdict: "allow" };
  }

  private checkPath(inputPath: string): GuardResult | null {
    let resolved: string;
    try {
      resolved = path.resolve(inputPath);
    } catch {
      return { verdict: "deny", reason: `无法解析路径: ${inputPath}` };
    }
    const normalized = path.normalize(resolved);
    const isAllowed = this.policy.allowedPaths.some((allowed) => {
      const resolvedAllowed = path.resolve(allowed);
      return normalized.startsWith(resolvedAllowed + path.sep) || normalized === resolvedAllowed;
    });
    if (!isAllowed) {
      return { verdict: "deny", reason: `路径 "${inputPath}" (规范化: ${normalized}) 不在允许范围内` };
    }
    return null;
  }

  private checkCommand(command: string): GuardResult | null {
    for (const banned of this.policy.bannedCommands) {
      if (command.includes(banned)) {
        return { verdict: "deny", reason: `命令包含禁止模式: "${banned}"` };
      }
    }
    return null;
  }
}