import { execSync } from "child_process";
import { Sensor, SensorOutput, Feedback } from "../types";

export class TestSensor implements Sensor {
  name = "test";

  async run(): Promise<SensorOutput> {
    try {
      const output = execSync("npm test 2>&1", { encoding: "utf-8", timeout: 120000 });
      return this.parseOutput(output, true);
    } catch (err: any) {
      const output = (err.stdout || "") + (err.stderr || "");
      return this.parseOutput(output, false);
    }
  }

  private parseOutput(output: string, passed: boolean): SensorOutput {
    if (passed) {
      return { status: "pass", details: "All tests passed", failureCount: 0 };
    }
    const countMatch = output.match(/Tests:\s+(\d+)\s+failed/);
    const failureCount = countMatch ? parseInt(countMatch[1]) : 1;
    return { status: "fail", details: output.slice(-2000), failureCount };
  }

  parse(output: SensorOutput): Feedback {
    return {
      hasFailures: output.status === "fail",
      message: `[测试] ${output.failureCount > 0 ? `${output.failureCount} 个测试失败` : "全部通过"}\n\n${output.details.slice(0, 1500)}`,
      failureCount: output.failureCount,
    };
  }
}