import { ActionParser } from "./action-parser";

describe("ActionParser", () => {
  const parser = new ActionParser();

  test("parses valid glob action", () => {
    const { action, error } = parser.parse('{"type":"glob","pattern":"**/*.ts"}');
    expect(error).toBeUndefined();
    expect(action).toEqual({ type: "glob", pattern: "**/*.ts" });
  });

  test("parses valid shell action", () => {
    const { action, error } = parser.parse('{"type":"shell","command":"npm test"}');
    expect(error).toBeUndefined();
    expect(action).toEqual({ type: "shell", command: "npm test" });
  });

  test("parses valid done action", () => {
    const { action, error } = parser.parse('{"type":"done","summary":"all done"}');
    expect(error).toBeUndefined();
    expect(action).toEqual({ type: "done", summary: "all done" });
  });

  test("returns error for invalid JSON", () => {
    const { action, error } = parser.parse("not json");
    expect(action).toBeNull();
    expect(error).toContain("解析失败");
  });

  test("returns error for unknown action type", () => {
    const { action, error } = parser.parse('{"type":"unknown_action"}');
    expect(action).toBeNull();
    expect(error).toContain("未知的动作类型");
  });

  test("returns error for missing required field", () => {
    const { action, error } = parser.parse('{"type":"shell"}');
    expect(action).toBeNull();
    expect(error).toContain("缺少必需字段");
  });

  test("handles LLM output with extra text around JSON", () => {
    const { action, error } = parser.parse('Here is my action: {"type":"done","summary":"ok"}');
    expect(error).toBeUndefined();
    expect(action).toEqual({ type: "done", summary: "ok" });
  });
});