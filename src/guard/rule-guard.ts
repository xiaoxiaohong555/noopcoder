import { GuardRule, GuardResult } from "./types";
import { Action } from "../action/types";

export class RuleGuard {
  constructor(private rules: GuardRule[]) {}

  check(action: Action): GuardResult {
    for (const rule of this.rules) {
      const matched = this.matchRule(action, rule);
      if (matched) {
        return { verdict: rule.action, reason: `匹配规则: ${rule.pattern}`, matchedRule: rule.pattern };
      }
    }
    return { verdict: "allow" };
  }

  private matchRule(action: Action, rule: GuardRule): boolean {
    switch (rule.matchOn) {
      case "command":
        return action.type === "shell" && (action as any).command?.includes(rule.pattern);
      case "path":
        return (action.type === "read_file" || action.type === "write_file" || action.type === "glob" || action.type === "grep")
          && (action as any).path?.includes(rule.pattern);
      case "action_type":
        return action.type === rule.pattern;
      default:
        return false;
    }
  }
}