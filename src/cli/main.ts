#!/usr/bin/env node

import { Agent } from "../core/agent";
import { ActionParser } from "../action/action-parser";
import { OpenAICompatibleClient } from "../llm/openai-compatible-client";
import { GuardPipeline } from "../guard/guard-pipeline";
import { RuleGuard } from "../guard/rule-guard";
import { SandboxGuard } from "../guard/sandbox-guard";
import { HITLGuard } from "../guard/hitl-guard";
import { InteractiveApprover } from "../guard/approvers/interactive-approver";
import { ToolDispatcher } from "../tools/tool-dispatcher";
import { GlobTool } from "../tools/glob-tool";
import { GrepTool } from "../tools/grep-tool";
import { ReadFileTool } from "../tools/read-file-tool";
import { WriteFileTool } from "../tools/write-file-tool";
import { ShellTool } from "../tools/shell-tool";
import { TestTool } from "../tools/test-tool";
import { FeedbackLoop } from "../feedback/feedback-loop";
import { TestSensor } from "../feedback/sensors/test-sensor";
import { LintSensor } from "../feedback/sensors/lint-sensor";
import { TypeCheckSensor } from "../feedback/sensors/type-check-sensor";
import { FileMemory } from "../memory/file-memory";
import { ConfigLoader } from "../config/config-loader";
import { CredentialManager } from "../config/credential-manager";

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const credManager = new CredentialManager();

  switch (cmd) {
    case "setup":
      await credManager.setApiKey();
      break;
    case "status":
      await credManager.showStatus();
      break;
    case "clear":
      await credManager.clearApiKey();
      break;
    case "run":
    default:
      await runAgent(args.join(" "), credManager);
      break;
  }
}

async function runAgent(goal: string, credManager: CredentialManager) {
  if (!goal || goal === "run") {
    console.log("用法: noopcoder run <你的任务描述>");
    console.log("示例: noopcoder run 修复 src/utils.ts 中的类型错误");
    process.exit(1);
  }

  const apiKey = process.env.NOOPCODER_API_KEY || (await credManager.getApiKey());
  if (!apiKey) {
    console.log("未配置 API Key。请运行: noopcoder setup");
    process.exit(1);
  }

  const config = ConfigLoader.load();

  // Build tools
  const dispatcher = new ToolDispatcher();
  dispatcher.register(new GlobTool());
  dispatcher.register(new GrepTool());
  dispatcher.register(new ReadFileTool());
  dispatcher.register(new WriteFileTool());
  dispatcher.register(new ShellTool());
  dispatcher.register(new TestTool());

  // Build guard
  const guard = new GuardPipeline(
    new RuleGuard(config.guardRules),
    new SandboxGuard(config.sandbox),
    new HITLGuard(new InteractiveApprover()),
  );

  // Build feedback
  const sensors = [];
  if (config.sensors.includes("test")) sensors.push(new TestSensor());
  if (config.sensors.includes("lint")) sensors.push(new LintSensor());
  if (config.sensors.includes("typecheck")) sensors.push(new TypeCheckSensor());
  const feedback = new FeedbackLoop(sensors);

  // Build agent
  const agent = new Agent(
    new OpenAICompatibleClient(config.llm, apiKey),
    new ActionParser(),
    guard,
    dispatcher,
    feedback,
    new FileMemory(),
    config,
  );

  console.log(`\n🤖 NoOpCoder 启动\n任务: ${goal}\n`);
  const result = await agent.run(goal);
  console.log(`\n✅ 完成 (${result.steps} 步, 状态: ${result.status})`);
  console.log(result.summary);
}

main().catch(console.error);