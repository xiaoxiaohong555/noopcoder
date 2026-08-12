import { GuardPipeline } from "./guard-pipeline";
import { RuleGuard } from "./rule-guard";
import { SandboxGuard } from "./sandbox-guard";
import { HITLGuard } from "./hitl-guard";
import { StubApprover } from "./approvers/stub-approver";
import { GuardRule, SandboxPolicy } from "./types";
import * as path from "path";

const rules: GuardRule[] = [
  { pattern: "rm -rf", matchOn: "command", action: "deny" },
  { pattern: "git push", matchOn: "command", action: "ask" },
];
const policy: SandboxPolicy = {
  allowedPaths: [path.resolve("/project")],
  bannedCommands: ["sudo"],
  timeoutMs: 30000,
  maxFileSize: 1024 * 1024,
};

describe("GuardPipeline", () => {
  test("RuleGuard denies before SandboxGuard", async () => {
    const pipeline = new GuardPipeline(
      new RuleGuard(rules),
      new SandboxGuard(policy),
      new HITLGuard(new StubApprover("always_allow"))
    );
    const result = await pipeline.check({ type: "shell", command: "sudo rm -rf /" });
    expect(result.verdict).toBe("deny");
    expect(result.matchedRule).toBe("rm -rf");
  });

  test("escalates to HITL for ask rules", async () => {
    const pipeline = new GuardPipeline(
      new RuleGuard(rules),
      new SandboxGuard(policy),
      new HITLGuard(new StubApprover("always_allow"))
    );
    const result = await pipeline.check({ type: "shell", command: "git push origin main" });
    expect(result.verdict).toBe("allow");
  });
});