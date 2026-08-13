import * as fs from "fs";
import * as path from "path";
import { Tool } from "./types";
import { Action, ToolResult } from "../action/types";

export class WriteFileTool implements Tool {
  name = "write_file";
  description = "Write content to a file, creating parent directories if needed";
  parameters = {
    path: { type: "string", description: "Path to file", required: true },
    content: { type: "string", description: "Content to write", required: true },
  };

  async execute(action: Action): Promise<ToolResult> {
    const a = action as any;
    try {
      const dir = path.dirname(a.path);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(a.path, a.content, "utf-8");
      return { success: true, output: `已写入 ${a.path}`, action, changedCode: true };
    } catch (err: any) {
      return { success: false, output: `写入失败: ${err.message}`, action, changedCode: false, error: err.message };
    }
  }
}