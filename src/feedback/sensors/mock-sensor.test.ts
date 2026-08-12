import { MockSensor } from "./mock-sensor";

describe("MockSensor", () => {
  test("returns preset failure", async () => {
    const sensor = new MockSensor({
      status: "fail",
      details: "1 test failed: expect(1+1).toBe(3)",
      failureCount: 1,
    });
    const output = await sensor.run();
    expect(output.status).toBe("fail");
    const feedback = sensor.parse(output);
    expect(feedback.hasFailures).toBe(true);
    expect(feedback.failureCount).toBe(1);
  });

  test("returns preset pass", async () => {
    const sensor = new MockSensor({ status: "pass", details: "All tests pass", failureCount: 0 });
    const output = await sensor.run();
    const feedback = sensor.parse(output);
    expect(feedback.hasFailures).toBe(false);
  });
});