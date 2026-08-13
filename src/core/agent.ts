import { Context } from "./context";
import { LLMClient } from "../llm/types";
import { ActionParser } from "../action/action-parser";
import { GuardPipeline } from "../guard/guard-pipeline";
import { ToolDispatcher } from "../tools/tool-dispatcher";
import { FeedbackLoop } from "../feedback/feedback-loop";
import { Memory } from "../memory/file-memory";
import { Config } from "../config/types";

export interface AgentResult {
  status: "success" | "timeout" | "max_steps" | "failure";
  summary: string;
  steps: number;
}

export class Agent {
  constructor(
    private llm: LLMClient,
    private parser: ActionParser,
    private guard: GuardPipeline,
    private dispatcher: ToolDispatcher,
    private feedback: FeedbackLoop,
    private memory: Memory,
    private config: Config,
  ) {}

  async run(goal: string): Promise<AgentResult> {
    const ctx = new Context();
    ctx.addSystem(
      `你是一个编码智能体。你的任务是通过调用工具来完成编码工作。

你必须以 JSON 格式输出下一步动作。格式如下：
- {"type":"glob","pattern":"**/*.ts"} — 浏览文件
- {"type":"grep","pattern":"pattern","path":"dir"} — 搜索代码
- {"type":"read_file","path":"path/to/file"} — 读取文件
- {"type":"write_file","path":"path/to/file","content":"..."} — 写入文件
- {"type":"shell","command":"command"} — 执行命令
- {"type":"run_tests","target":"file"} — 运行测试
- {"type":"done","summary":"完成了什么"} — 任务完成

不要输出 JSON 以外的任何内容。`,
    );
    ctx.addRules(`你正在 ${process.cwd()} 目录下工作。`);
    ctx.addMemory(await this.memory.retrieve(goal));
    ctx.addGoal(goal);

    let steps = 0;
    let consecutiveFailures = 0;
    const startTime = Date.now();

    while (steps < this.config.run.maxSteps) {
      // Timeout check
      if (Date.now() - startTime > this.config.run.timeoutMs) {
        await this.memory.consolidate(ctx.summary());
        return { status: "timeout", summary: ctx.summary(), steps };
      }

      // Consecutive failure check
      if (consecutiveFailures >= this.config.run.maxConsecutiveFailures) {
        await this.memory.consolidate(ctx.summary());
        return {
          status: "failure",
          summary: `连续 ${consecutiveFailures} 次失败，熔断`,
          steps,
        };
      }

      // Context compression
      if (ctx.messages.length > 30) {
        ctx.compress();
      }

      steps++;

      // LLM call
      let response: any;
      try {
        response = await this.llm.complete(ctx.messages);
      } catch (err: any) {
        ctx.addUser(`LLM 调用失败: ${err.message}`);
        consecutiveFailures++;
        continue;
      }

      // Handle finishReason
      if (response.finishReason === "length") {
        ctx.addUser("输出被截断，请缩短回答。");
        continue;
      }

      if (response.finishReason === "error") {
        ctx.addUser("API 调用出错，请重试。");
        consecutiveFailures++;
        continue;
      }

      // Parse action
      const { action, error } = this.parser.parse(response.content);
      if (error || !action) {
        ctx.addUser(error || "解析失败");
        consecutiveFailures++;
        continue;
      }

      ctx.addAssistant(response.content);

      // Done check
      if (action.type === "done") {
        await this.memory.consolidate(ctx.summary());
        return { status: "success", summary: (action as any).summary, steps };
      }

      // Guard check
      const guardResult = await this.guard.check(action);
      if (guardResult.verdict === "deny") {
        ctx.addUser(`动作被拦截: ${guardResult.reason || "策略禁止"}`);
        consecutiveFailures++;
        continue;
      }

      // Execute tool
      let toolResult: any;
      try {
        toolResult = await this.dispatcher.execute(action);
      } catch (err: any) {
        ctx.addUser(`工具执行失败: ${err.message}`);
        consecutiveFailures++;
        continue;
      }

      if (!toolResult.success) {
        consecutiveFailures++;
      } else {
        consecutiveFailures = 0;
      }

      ctx.addUser(toolResult.output);

      // Feedback loop (only when code was changed)
      if (toolResult.changedCode) {
        const feedback = await this.feedback.evaluate(action, toolResult);
        if (feedback) {
          ctx.addUser(`[反馈] ${feedback.message}`);
        }
      }
    }

    await this.memory.consolidate(ctx.summary());
    return { status: "max_steps", summary: ctx.summary(), steps };
  }
}