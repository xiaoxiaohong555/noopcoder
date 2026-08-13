import * as fs from "fs";
import { Tool } from "./types";
import { Action, ToolResult } from "../action/types";

export class GrepTool implements Tool {
  name = "grep";
  description = "Search for a pattern in files";
  parameters = {
    pattern: { type: "string", description: "Regex pattern to search for", required: true },
    path: { type: "string", description: "File or directory to search in" },
  };

  async execute(action: Action): Promise<ToolResult> {
    const a = action as any;
    const searchPath = a.path || ".";
    const pattern = new RegExp(a.pattern, "g");
    const results: string[] = [];
    try {
      const stat = fs.statSync(searchPath);
      const files = stat.isDirectory()
        ? fs.readdirSync(searchPath, { recursive: true }).map((f) => `${searchPath}/${f}`)
        : [searchPath];
      for (const file of files.slice(0, 50)) {
        try {
          const content = fs.readFileSync(file, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
              results.push(`${file}:${i + 1}: ${lines[i].trim()}`);
            }
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
    return {
      success: true,
      output: results.length > 0 ? results.slice(0, 30).join("\n") : "(no matches)",
      action,
      changedCode: false,
    };
  }
}