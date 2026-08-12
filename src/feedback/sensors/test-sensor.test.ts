import { TestSensor } from "./test-sensor";

describe("TestSensor", () => {
  test("parse passes on success", () => {
    const sensor = new TestSensor();
    const feedback = sensor.parse({ status: "pass", details: "ok", failureCount: 0 });
    expect(feedback.hasFailures).toBe(false);
  });

  test("parse fails on failure", () => {
    const sensor = new TestSensor();
    const feedback = sensor.parse({ status: "fail", details: "1 failed", failureCount: 1 });
    expect(feedback.hasFailures).toBe(true);
    expect(feedback.failureCount).toBe(1);
  });
});