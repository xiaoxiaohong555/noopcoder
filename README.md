# NoOpCoder — Coding Agent Harness

> AI4SE 期末项目 A 类。从零实现的 Coding Agent Harness，含 mock-LLM 可测试性、三层治理护栏、反馈闭环。
>
> **核心命题：Agent = LLM + Harness。LLM 只占一行任务决策，其余全是工程。**
>
> [![CI](https://github.com/xiaoxiaohong555/noopcoder/actions/workflows/ci.yml/badge.svg)](https://github.com/xiaoxiaohong555/noopcoder/actions)

## 快速开始

### 本地运行

```bash
npm install
npm run build

# 配置 API Key
node dist/cli/main.js setup

# 运行
node dist/cli/main.js run "修复 src/utils.ts 中的 bug"
```

### Docker 运行

```bash
docker build -t noopcoder .
docker run -it -e NOOPCODER_API_KEY=sk-xxx noopcoder run "你的任务"
```

### 云部署

```bash
# 在服务器上
docker build -t noopcoder .
docker run -d --restart=unless-stopped \
  -e NOOPCODER_API_KEY=sk-xxx \
  --name noopcoder \
  noopcoder run "自动执行任务"
```

## 机制演示

```bash
npm run demo
```

无需网络、无需真实 LLM，确定性复现三个场景：
1. **治理护栏拦截危险动作** — `rm -rf /` 被 RuleGuard 拦截 ✅
2. **反馈闭环使 Agent 改变行为** — MockLLM + MockSensor 驱动自我修正 ✅
3. **沙箱路径穿越防护** — `/project/../etc/passwd` 被 SandboxGuard 拦截 ✅

## API Key 安全

- **本地**：通过 `noopcoder setup` 交互式录入，存储在 `~/.noopcoder/credentials`
- **Docker**：通过环境变量 `NOOPCODER_API_KEY` 注入
- Key 绝不硬编码，不入 Git，不入日志

## 测试

```bash
npm test              # 全部测试
npm run test:mock     # 仅 mock 测试（无需网络，无需真实 LLM）
npm run demo          # 机制演示（3 个场景确定性复现）
```

## 架构

```
CLI → Agent 主循环 → (LLMClient → ActionParser → GuardPipeline → ToolDispatcher → FeedbackLoop)
       ↓                    ↓                ↓               ↓
    Memory              GuardPipeline    ToolDispatcher   FeedbackLoop
    (JSON 文件)          ├ RuleGuard      ├ GlobTool       ├ TestSensor
    Config              ├ SandboxGuard   ├ GrepTool       ├ LintSensor
    (声明式规则)         └ HITLGuard      ├ ReadFileTool   └ TypeCheckSensor
    CredentialManager                    ├ WriteFileTool
    (安全存储)                            ├ ShellTool
                                         └ TestTool
```

### 六大维度

| 维度 | 实现 | 深度 |
|------|------|------|
| 决策封装 | Agent 主循环 + 停机判断 | 基础 |
| 动作/工具 | 6 个内置工具 + ToolDispatcher | 基础 |
| 治理护栏 | RuleGuard → SandboxGuard → HITLGuard | ⭐ 重点深入 |
| 反馈闭环 | TestSensor + LintSensor + TypeCheckSensor | 基础 |
| 记忆系统 | FileMemory（JSON 文件持久化） | 最低实现 |
| 配置系统 | 声明式规则 + 用户覆盖 | 基础 |

### 重点维度：治理护栏（三层架构）

```
Action → RuleGuard → SandboxGuard → HITLGuard → 放行
           ↓              ↓             ↓
      规则匹配       路径规范化     人工确认
      (确定性)      (确定性)     (状态机)
```

- **RuleGuard**：预定义规则表，HashMap 精确匹配 + glob/regex 模式匹配
- **SandboxGuard**：路径规范化（resolve → normalize → canonical），防御穿越攻击
- **HITLGuard**：状态机 `IDLE → WAITING → APPROVED/DENIED`，支持 stub 注入

## 目录结构

```
src/
  core/       Agent 主循环 + Context
  llm/        LLM 抽象层 (MockLLMClient + OpenAICompatibleClient)
  action/     Action 协议 + ActionParser
  tools/      6 个内置工具 + ToolDispatcher
  guard/      三层治理护栏 ⭐ (RuleGuard + SandboxGuard + HITLGuard)
  feedback/   反馈闭环 + Sensor 管道
  memory/     FileMemory（JSON 持久化）
  config/     ConfigLoader + CredentialManager
  cli/        CLI 入口（setup/status/clear/run）
  demo/       机制演示脚本（3 场景确定性复现）
```

## 分发

### Docker 镜像

```bash
# 构建
docker build -t noopcoder .

# 运行（API Key 通过环境变量注入）
docker run -it -e NOOPCODER_API_KEY=sk-xxx noopcoder run "你的任务"
```

**Key 安全配置**：容器内不支持文件凭据存储，统一使用环境变量 `NOOPCODER_API_KEY` 注入。

**已知限制**：沙箱路径限制在容器内生效；仅支持 OpenAI 兼容 API。

### 技术栈

- TypeScript 5.x + Node.js 20+
- Jest（测试框架）
- OpenAI SDK（仅 HTTP 调用层）
- 无 agent 编排框架依赖（LangChain/AutoGen/CrewAI 均不使用）

## 已知限制

- 仅支持 OpenAI 兼容 API
- 记忆系统为最低实现（JSON 文件）
- 路径规范化在 Windows 和 Linux 下行为一致
- 需自行配置 API Key