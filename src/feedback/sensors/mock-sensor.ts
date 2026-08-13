import { Sensor, SensorOutput, Feedback } from "../types";

export class MockSensor implements Sensor {
  name = "mock";

  constructor(private mockOutput: SensorOutput) {}

  async run(): Promise<SensorOutput> {
    return this.mockOutput;
  }

  parse(output: SensorOutput): Feedback {
    return {
      hasFailures: output.status === "fail" || output.status === "error",
      message: `[${this.name}] ${output.details}`,
      failureCount: output.failureCount,
    };
  }
}