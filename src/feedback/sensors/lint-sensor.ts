import { execSync } from "child_process";
import { Sensor, SensorOutput, Feedback } from "../types";

export class LintSensor implements Sensor {
  name = "lint";

  async run(): Promise<SensorOutput> {
    try {
      execSync("npx eslint . 2>&1", { encoding: "utf-8", timeout: 60000 });
      return { status: "pass", details: "No lint errors", failureCount: 0 };
    } catch (err: any) {
      const output = (err.stdout || "") + (err.stderr || "");
      const count = (output.match(/error/g) || []).length;
      return { status: "fail", details: output.slice(-2000), failureCount: count || 1 };
    }
  }

  parse(output: SensorOutput): Feedback {
    return {
      hasFailures: output.status === "fail",
      message: `[Lint] ${output.failureCount > 0 ? `${output.failureCount} 个 lint 错误` : "无 lint 错误"}\n\n${output.details.slice(0, 1500)}`,
      failureCount: output.failureCount,
    };
  }
}