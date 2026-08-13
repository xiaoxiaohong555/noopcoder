import { Action, ToolResult } from "../action/types";

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute(action: Action): Promise<ToolResult>;
}