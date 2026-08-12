import { MockLLMClient } from "./mock-llm-client";
import { Action } from "../action/types";

describe("MockLLMClient", () => {
  test("returns actions in sequence", async () => {
    const actions: Action[] = [
      { type: "glob", pattern: "*.ts" },
      { type: "shell", command: "npm test" },
      { type: "done", summary: "done" },
    ];
    const client = new MockLLMClient(actions);

    const r1 = await client.complete([{ role: "user", content: "task" }]);
    expect(JSON.parse(r1.content)).toEqual({ type: "glob", pattern: "*.ts" });

    const r2 = await client.complete([{ role: "user", content: "task" }]);
    expect(JSON.parse(r2.content)).toEqual({ type: "shell", command: "npm test" });

    const r3 = await client.complete([{ role: "user", content: "task" }]);
    expect(JSON.parse(r3.content)).toEqual({ type: "done", summary: "done" });
  });

  test("throws when actions exhausted", async () => {
    const client = new MockLLMClient([]);
    await expect(client.complete([])).rejects.toThrow("MockLLMClient: no more actions");
  });

  test("returns realistic usage data", async () => {
    const client = new MockLLMClient([{ type: "done", summary: "ok" }]);
    const r = await client.complete([{ role: "user", content: "hi" }]);
    expect(r.finishReason).toBe("stop");
    expect(r.usage.totalTokens).toBeGreaterThan(0);
  });
});