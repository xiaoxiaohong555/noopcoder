import * as fs from "fs";
import * as path from "path";
import { Tool } from "./types";
import { Action, ToolResult } from "../action/types";

export class GlobTool implements Tool {
  name = "glob";
  description = "Find files matching a glob pattern";
  parameters = {
    pattern: { type: "string", description: "Glob pattern (e.g., **/*.ts)", required: true },
  };

  async execute(action: Action): Promise<ToolResult> {
    const a = action as any;
    const cwd = process.cwd();
    const results: string[] = [];
    this.walk(cwd, a.pattern, results);
    return {
      success: true,
      output: results.length > 0 ? results.join("\n") : "(no files matched)",
      action,
      changedCode: false,
    };
  }

  private walk(dir: string, pattern: string, results: string[], depth = 0): void {
    if (depth > 10) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
          this.walk(full, pattern, results, depth + 1);
        } else if (entry.isFile() && this.matchSimple(entry.name, pattern)) {
          results.push(full);
        }
      }
    } catch { /* skip inaccessible dirs */ }
  }

  private matchSimple(name: string, pattern: string): boolean {
    if (pattern === "*" || pattern === "**/*") return true;
    if (pattern.startsWith("**/")) return name.endsWith(pattern.slice(3));
    if (pattern.startsWith("*.")) return name.endsWith(pattern.slice(1));
    return name === pattern;
  }
}