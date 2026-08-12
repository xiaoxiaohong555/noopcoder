import { execSync } from "child_process";
import { Sensor, SensorOutput, Feedback } from "../types";

export class TypeCheckSensor implements Sensor {
  name = "typecheck";

  async run(): Promise<SensorOutput> {
    try {
      execSync("npx tsc --noEmit 2>&1", { encoding: "utf-8", timeout: 60000 });
      return { status: "pass", details: "No type errors", failureCount: 0 };
    } catch (err: any) {
      const output = (err.stdout || "") + (err.stderr || "");
      const count = (output.match(/error TS\d+/g) || []).length;
      return { status: "fail", details: output.slice(-2000), failureCount: count || 1 };
    }
  }

  parse(output: SensorOutput): Feedback {
    return {
      hasFailures: output.status === "fail",
      message: `[类型检查] ${output.failureCount > 0 ? `${output.failureCount} 个类型错误` : "无类型错误"}\n\n${output.details.slice(0, 1500)}`,
      failureCount: output.failureCount,
    };
  }
}