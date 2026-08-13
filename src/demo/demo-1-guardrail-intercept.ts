import { RuleGuard } from "../guard/rule-guard";
import { GuardRule } from "../guard/types";

export function demo1_run(): boolean {
  const rules: GuardRule[] = [
    { pattern: "rm -rf", matchOn: "command", action: "deny" },
    { pattern: "DROP TABLE", matchOn: "command", action: "deny" },
  ];
  const guard = new RuleGuard(rules);

  const result = guard.check({ type: "shell", command: "rm -rf /" });

  console.log("=== 演示 1: 治理护栏拦截危险动作 ===");
  console.log(`动作: shell "rm -rf /"`);
  console.log(`结果: verdict=${result.verdict}, matchedRule=${result.matchedRule}`);
  console.log(
    result.verdict === "deny" ? "✅ 测试通过: 危险动作被拦截" : "❌ 测试失败",
  );
  console.log("");

  return result.verdict === "deny";
}