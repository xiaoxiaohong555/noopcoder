import * as readline from "readline";
import { Approver } from "./approver";
import { Action } from "../../action/types";

export class InteractiveApprover implements Approver {
  async approve(action: Action): Promise<{ approved: boolean; reason?: string }> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = `\n⚠ 动作需要确认:\n  类型: ${action.type}\n  内容: ${JSON.stringify(action)}\n\n允许执行？[y/N] `;
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        if (answer.toLowerCase() === "y") resolve({ approved: true });
        else resolve({ approved: false, reason: "用户拒绝" });
      });
    });
  }
}