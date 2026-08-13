import { SandboxGuard } from "../guard/sandbox-guard";
import { SandboxPolicy } from "../guard/types";
import * as path from "path";

export function demo3_run(): boolean {
  const policy: SandboxPolicy = {
    allowedPaths: [path.resolve("/project")],
    bannedCommands: [],
    timeoutMs: 30000,
    maxFileSize: 1024 * 1024,
  };
  const guard = new SandboxGuard(policy);

  const result = guard.check({
    type: "read_file",
    path: "/project/../etc/passwd",
  });

  console.log("=== 演示 3: 沙箱路径穿越防护 ===");
  console.log(`动作: read_file "/project/../etc/passwd"`);
  console.log(`结果: verdict=${result.verdict}, reason=${result.reason}`);
  console.log(
    result.verdict === "deny" ? "✅ 测试通过: 路径穿越被拦截" : "❌ 测试失败",
  );
  console.log("");

  return result.verdict === "deny";
}