import { FeedbackLoop } from "./feedback-loop";
import { MockSensor } from "./sensors/mock-sensor";
import { Action } from "../action/types";

describe("FeedbackLoop", () => {
  test("skips when changedCode is false", async () => {
    const loop = new FeedbackLoop([new MockSensor({ status: "fail", details: "err", failureCount: 1 })]);
    const result = { success: true, output: "ok", action: { type: "glob" as const, pattern: "*" } as Action, changedCode: false };
    const feedback = await loop.evaluate({ type: "glob", pattern: "*" } as Action, result);
    expect(feedback).toBeNull();
  });

  test("triggers when changedCode is true", async () => {
    const loop = new FeedbackLoop([new MockSensor({ status: "fail", details: "1 test failed", failureCount: 1 })]);
    const result = { success: true, output: "ok", action: { type: "write_file" as const, path: "x.ts", content: "x" } as Action, changedCode: true };
    const feedback = await loop.evaluate({ type: "write_file", path: "x.ts", content: "x" } as Action, result);
    expect(feedback).not.toBeNull();
    expect(feedback!.hasFailures).toBe(true);
  });

  test("returns null when all sensors pass", async () => {
    const loop = new FeedbackLoop([new MockSensor({ status: "pass", details: "ok", failureCount: 0 })]);
    const result = { success: true, output: "ok", action: { type: "write_file" as const, path: "x.ts", content: "x" } as Action, changedCode: true };
    const feedback = await loop.evaluate({ type: "write_file", path: "x.ts", content: "x" } as Action, result);
    expect(feedback).toBeNull();
  });
});