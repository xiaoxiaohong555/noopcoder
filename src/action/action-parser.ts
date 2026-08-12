import { Action } from "./types";

const VALID_TYPES = ["glob", "grep", "read_file", "write_file", "shell", "run_tests", "done"];

const REQUIRED_FIELDS: Record<string, string[]> = {
  glob: ["pattern"],
  grep: ["pattern"],
  read_file: ["path"],
  write_file: ["path", "content"],
  shell: ["command"],
  run_tests: [],
  done: ["summary"],
};

export class ActionParser {
  parse(raw: string): { action: Action | null; error?: string } {
    // Try to extract JSON from the raw text (LLM may add extra text)
    const json = this.extractJson(raw);
    if (!json) {
      return {
        action: null,
        error: `解析失败：无法从输出中提取 JSON。原始输出：${raw.slice(0, 200)}`,
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch {
      return {
        action: null,
        error: `解析失败：无效的 JSON 格式。原始内容：${json.slice(0, 200)}`,
      };
    }

    if (!parsed.type || !VALID_TYPES.includes(parsed.type)) {
      return {
        action: null,
        error: `解析失败：未知的动作类型 "${parsed.type}"。有效类型：${VALID_TYPES.join(", ")}`,
      };
    }

    const required = REQUIRED_FIELDS[parsed.type] || [];
    for (const field of required) {
      if (parsed[field] === undefined) {
        return {
          action: null,
          error: `解析失败：动作 "${parsed.type}" 缺少必需字段 "${field}"`,
        };
      }
    }

    return { action: parsed as Action };
  }

  private extractJson(raw: string): string | null {
    // Try to find JSON object in the text
    const match = raw.match(/\{[\s\S]*"type"[\s\S]*\}/);
    return match ? match[0] : null;
  }
}