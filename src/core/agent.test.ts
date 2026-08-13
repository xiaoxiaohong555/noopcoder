import { Agent } from "./agent";
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
import { FileMemory } from "../memory/file-memory";
import { DEFAULT_CONFIG, Config } from "../config/types";
import * as fs from "fs";
import * as path from "path";

const tmpDir = path.join(__dirname, "..", "..", "test-tmp-agent");

function buildToolDispatcher(): ToolDispatcher {
  const dispatcher = new ToolDispatcher();
  const mockTool: Tool = {
    name: "glob",
    description: "find files",
    parameters: { pattern: { type: "string", description: "glob", required: true } },
    execute: async (a) => ({ success: true, output: "a.ts", action: a, changedCode: false }),
  };
  dispatcher.register(mockTool);
  const writeTool: Tool = {
    name: "write_file",
    description: "write file",
    parameters: {
      path: { type: "string", description: "path", required: true },
      content: { type: "string", description: "content", required: true },
    },
    execute: async (a) => ({ success: true, output: "ok", action: a, changedCode: true }),
  };
  dispatcher.register(writeTool);
  const shellTool: Tool = {
    name: "shell",
    description: "run command",
    parameters: { command: { type: "string", description: "cmd", required: true } },
    execute: async (a) => ({ success: true, output: "ok", action: a, changedCode: false }),
  };
  dispatcher.register(shellTool);
  return dispatcher;
}

function buildAgent(mockActions: any[], config: Partial<Config> = {}): Agent {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  return new Agent(
    new MockLLMClient(mockActions),
    new ActionParser(),
    new GuardPipeline(
      new RuleGuard(config.guardRules || mergedConfig.guardRules),
      new SandboxGuard({ ...mergedConfig.sandbox, allowedPaths: [process.cwd(), tmpDir] }),
      new HITLGuard(new StubApprover("always_allow")),
    ),
    buildToolDispatcher(),
    new FeedbackLoop([]),
    new FileMemory(tmpDir),
    mergedConfig,
  );
}

describe("Agent (integration)", () => {
  beforeAll(() => { fs.mkdirSync(tmpDir, { recursive: true }); });
  afterAll(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  test("completes with done action", async () => {
    const agent = buildAgent([
      { type: "glob", pattern: "*.ts" },
      { type: "done", summary: "全部完成" },
    ]);
    const result = await agent.run("列出文件");
    expect(result.status).toBe("success");
    expect(result.steps).toBe(2);
  });

  test("returns max_steps when no done", async () => {
    const agent = new Agent(
      new MockLLMClient(Array(10).fill({ type: "glob", pattern: "*.ts" })),
      new ActionParser(),
      new GuardPipeline(
        new RuleGuard([]),
        new SandboxGuard({ ...DEFAULT_CONFIG.sandbox, allowedPaths: [process.cwd()] }),
        new HITLGuard(new StubApprover("always_allow")),
      ),
      buildToolDispatcher(),
      new FeedbackLoop([]),
      new FileMemory(tmpDir),
      { ...DEFAULT_CONFIG, run: { ...DEFAULT_CONFIG.run, maxSteps: 3 } },
    );
    const result = await agent.run("test");
    expect(result.status).toBe("max_steps");
  });

  test("guardrail blocks dangerous action, agent continues", async () => {
    const agent = buildAgent(
      [
        { type: "shell", command: "rm -rf /" },
        { type: "done", summary: "done" },
      ],
      { guardRules: [{ pattern: "rm -rf", matchOn: "command", action: "deny" }] },
    );
    const result = await agent.run("delete files");
    expect(result.status).toBe("success");
    expect(result.steps).toBe(2);
  });
});