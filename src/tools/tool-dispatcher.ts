import { Tool } from "./types";
import { Action, ToolResult } from "../action/types";

export class ToolDispatcher {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  async execute(action: Action): Promise<ToolResult> {
    const tool = this.tools.get(action.type);
    if (!tool) {
      throw new Error(`未注册的工具: ${action.type}`);
    }
    return tool.execute(action);
  }
}