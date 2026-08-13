import { Approver } from "./approver";
import { Action } from "../../action/types";

export class StubApprover implements Approver {
  constructor(private response: "always_allow" | "always_deny") {}

  async approve(_action: Action): Promise<{ approved: boolean; reason?: string }> {
    if (this.response === "always_allow") return { approved: true };
    return { approved: false, reason: "StubApprover: 自动拒绝" };
  }
}