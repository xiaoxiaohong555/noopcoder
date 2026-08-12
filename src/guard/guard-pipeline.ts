import { GuardResult } from "./types";
import { RuleGuard } from "./rule-guard";
import { SandboxGuard } from "./sandbox-guard";
import { HITLGuard } from "./hitl-guard";
import { Action } from "../action/types";

export class GuardPipeline {
  constructor(
    private ruleGuard: RuleGuard,
    private sandboxGuard: SandboxGuard,
    private hitlGuard: HITLGuard
  ) {}

  async check(action: Action): Promise<GuardResult> {
    const ruleResult = this.ruleGuard.check(action);
    if (ruleResult.verdict === "deny") return ruleResult;
    if (ruleResult.verdict === "ask") {
      const hitlResult = await this.hitlGuard.check(action);
      if (hitlResult.verdict === "deny") return hitlResult;
    }
    const sandboxResult = this.sandboxGuard.check(action);
    if (sandboxResult.verdict === "deny") return sandboxResult;
    return { verdict: "allow" };
  }
}