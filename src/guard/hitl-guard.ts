import { GuardResult } from "./types";
import { Approver } from "./approvers/approver";
import { Action } from "../action/types";

export type HITLState = "idle" | "waiting" | "approved" | "denied";

export class HITLGuard {
  state: HITLState = "idle";

  constructor(private approver: Approver) {}

  async check(action: Action): Promise<GuardResult> {
    this.state = "waiting";
    const { approved, reason } = await this.approver.approve(action);
    if (approved) {
      this.state = "approved";
      return { verdict: "allow" };
    }
    this.state = "denied";
    return { verdict: "deny", reason: reason || "人工确认未通过" };
  }
}