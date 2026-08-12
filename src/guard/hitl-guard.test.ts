import { HITLGuard } from "./hitl-guard";
import { StubApprover } from "./approvers/stub-approver";

describe("HITLGuard", () => {
  test("stub allows action", async () => {
    const guard = new HITLGuard(new StubApprover("always_allow"));
    const result = await guard.check({ type: "shell", command: "git push" });
    expect(result.verdict).toBe("allow");
  });

  test("stub denies action", async () => {
    const guard = new HITLGuard(new StubApprover("always_deny"));
    const result = await guard.check({ type: "shell", command: "git push" });
    expect(result.verdict).toBe("deny");
    expect(result.reason).toBe("StubApprover: 自动拒绝");
  });

  test("starts in idle state", () => {
    const guard = new HITLGuard(new StubApprover("always_allow"));
    expect(guard.state).toBe("idle");
  });
});