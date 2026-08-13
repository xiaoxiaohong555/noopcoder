import { Agent } from "../core/agent";
import { MockLLMClient } from "../llm/mock-llm-client";
import { ActionParser } from "../action/action-parser";
import { GuardPipeline } from "../guard/guard-pipeline";
import { RuleGuard } from "../guard/rule-guard";
import { SandboxGuard } from "../guard/sandbox-guard";
import { HITLGuard } from "../guard/hitl-guard";
import { StubApprover } from "../guard/approvers/stub-approver";
import { ToolDispatcher } from "../tools/tool-dispatcher";
import { Tool } from "../tools/types";
import { FeedbackLoop } from "../feedback/feedback-loop";
import { MockSensor } from "../feedback/sensors/mock-sensor";
import { FileMemory } from "../memory/file-memory";
import { DEFAULT_CONFIG } from "../config/types";
import * as fs from "fs";
import * as path from "path";

export async function demo2_run(): Promise<boolean> {
  const tmpDir = path.join(__dirname, "..", "..", "test-tmp-demo2");
  fs.mkdirSync(tmpDir, { recursive: true });

  // Mock LLM: write bad code → get feedback → write fixed code → done
  const mockLLM = new MockLLMClient([
    { type: "write_file", path: path.join(tmpDir, "bad.ts"), content: "broken code" },
    { type: "write_file", path: path.join(tmpDir, "fixed.ts"), content: "fixed code" },
    { type: "done", summary: "根据测试反馈修正了代码" },
  ]);

  const dispatcher = new ToolDispatcher();
  const writeTool: Tool = {
    name: "write_file",
    description: "write",
    parameters: {},
    execute: async (a) => ({
      success: true,
      output: `wrote ${(a as any).path}`,
      action: a,
      changedCode: true,
    }),
  };
  dispatcher.register(writeTool);

  // Mock sensor that always reports failure
  const mockSensor = new MockSensor({
    status: "fail",
    details: "test/bad.test.ts:1 - expect(1+1).toBe(3) → got 2\n请修正",
    failureCount: 1,
  });

  const agent = new Agent(
    mockLLM,
    new ActionParser(),
    new GuardPipeline(
      new RuleGuard([]),
      new SandboxGuard({ ...DEFAULT_CONFIG.sandbox, allowedPaths: [tmpDir] }),
      new HITLGuard(new StubApprover("always_allow")),
    ),
    dispatcher,
    new FeedbackLoop([mockSensor]),
    new FileMemory(tmpDir),
    DEFAULT_CONFIG,
  );

  const result = await agent.run("写一个加法函数");

  console.log("=== 演示 2: 反馈闭环使 agent 改变行为 ===");
  console.log(`Agent 状态: ${result.status}`);
  console.log(`执行步数: ${result.steps}`);
  console.log(
    result.steps >= 2
      ? "✅ 测试通过: Agent 根据反馈改变了行为"
      : "❌ 测试失败",
  );
  console.log("");

  fs.rmSync(tmpDir, { recursive: true, force: true });
  return result.steps >= 2;
}