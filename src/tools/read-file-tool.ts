import * as fs from "fs";
import { Tool } from "./types";
import { Action, ToolResult } from "../action/types";

export class ReadFileTool implements Tool {
  name = "read_file";
  description = "Read the contents of a file";
  parameters = {
    path: { type: "string", description: "Path to the file to read", required: true },
  };

  async execute(action: Action): Promise<ToolResult> {
    const a = action as any;
    try {
      const content = fs.readFileSync(a.path, "utf-8");
      return { success: true, output: content, action, changedCode: false };
    } catch (err: any) {
      return { success: false, output: `读取文件失败: ${err.message}`, action, changedCode: false, error: err.message };
    }
  }
}