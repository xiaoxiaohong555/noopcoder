# SPEC: Coding Agent Harness — NoOpCoder

> 设计文档，由 brainstorming 产出。项目代号 "NoOpCoder"。
> 完整要求 = 本文件 + 《AI4SE 期末项目 · 通用要求》+ 《AI4SE Final Project A · Coding Agent Harness》

---

## 1. 问题陈述

**要解决的问题**：当 LLM 能完成大部分编码思考时，我们需要一个工程化的运行环境（harness），将 LLM 的"下一步决策"封装成稳定、可靠、可治理的编码智能体。本项目交付一个从零实现的 Coding Agent Harness 内核，而非对现成 agent 框架的配置封装。

**目标用户**：需要辅助编码的开发者，以及需要理解 Agent = LLM + Harness 这一方法论的 AI4SE 研究者。

**为什么值得做**：市面上大多数 coding agent 产品（Claude Code、Codex 等）的 harness 是闭源的，开发者无法理解其内部机制。一个开源的、可 mock 测试的、从零构建的 harness，是理解 Agent 工程的最佳教学工具。

**核心命题**：Agent = LLM + Harness。LLM 只占一行任务决策，其余全是工程。本项目用编码实现这套工程，再用 mock/单测验证它。

---

## 2. 用户故事

1. **作为开发者**，我想要一个 CLI 工具能接收我的编码需求，自动读写文件、执行命令，并返回完成结果，而不是手动一步步操作。

2. **作为安全敏感的用户**，我希望 agent 在执行 `rm -rf /` 或 `DROP TABLE` 这类危险命令之前被自动拦截，而不是靠 LLM 自觉。

3. **作为调试者**，我希望 agent 在写完代码后自动运行测试，如果测试失败，agent 能根据失败信息自我修正，而不是带着 bug 继续。

4. **作为学习者**，我希望 harness 的每一个核心机制（护栏、反馈、工具分发）都能用 mock LLM 做确定性单测，这样我可以离线理解它的工作原理，而不需要调用真实 LLM。

5. **作为运维者**，我希望能通过声明式配置文件（规则文件）来定制 agent 的行为（什么命令危险、什么路径可访问），而不需要修改 harness 源代码。

6. **作为新用户**，我希望首次运行时有引导流程帮我安全录入 API Key，且 Key 不会被明文写入日志、历史记录、或提交到 Git。

7. **作为课程助教**，我希望能一键运行机制演示脚本，在无需网络的环境下看到护栏拦截、反馈闭环、路径穿越防护三个场景的确定性复现。

---

## 3. 功能规约

### 3.1 Agent 主循环

| 项目 | 内容 |
|------|------|
| **输入** | 用户目标（自然语言字符串） |
| **行为** | 构建上下文 → 调用 LLM → 解析动作 → 护栏检查 → 工具执行 → 反馈回灌 → 循环 |
| **输出** | `AgentResult { status: "success" | "timeout" | "max_steps" | "failure", summary: string, steps: number }` |
| **停机条件** | (1) LLM 返回 `type: "done"`; (2) 达到 `maxSteps`; (3) 超过 `timeoutMs`; (4) 达到 `maxConsecutiveFailures` 熔断 |
| **错误处理** | 解析失败 → 回灌错误信息重试; API 调用失败 → 重试 N 次; 工具执行失败 → 不计入 changedCode 反馈 |

### 3.2 LLM 抽象层

```
LLMClient.complete(messages) → { content: string, finishReason: string, usage: TokenUsage }
```

- **RealLLMClient**：`OpenAICompatibleClient`，对接 `https://njusehub.info/v1`，OpenAI 兼容格式，API Key 从 CredentialManager 读取。客户端本身是厂商无关的——njusehub.info + GLM-5.2 仅作为默认配置
- **MockLLMClient**：接受预设 Action 数组，每次 `complete()` 按序返回下一个 action 的 JSON 字符串
- `finishReason` 处理：`stop` 无 done → 重试；`length` → 截断重试；`error` → 回灌重试

### 3.3 Action 协议

```
type Action =
  | { type: "glob"; pattern: string }
  | { type: "grep"; pattern: string; path?: string }
  | { type: "read_file"; path: string }
  | { type: "write_file"; path: string; content: string }
  | { type: "shell"; command: string }
  | { type: "run_tests"; target?: string }
  | { type: "done"; summary: string }
```

- LLM 输出纯文本 JSON，由 `ActionParser.parse()` 解析
- 解析失败 → 回灌错误信息，让 LLM 重试（最多 3 次）
- 不使用 function calling，保持厂商无关

### 3.4 工具分发（ToolDispatcher）

| 工具 | 实现 | changedCode | 特殊处理 |
|------|------|-------------|----------|
| `glob` | `fs.glob(pattern)` | `false` | 无 |
| `grep` | `readFile` + regex | `false` | 大文件截断结果 |
| `read_file` | `fs.readFile` | `false` | 路径经沙箱规范化检查 |
| `write_file` | `fs.writeFile` | `true` | 路径经沙箱规范化检查 |
| `shell` | `child_process.exec` | 检测工作区变化（文件 diff） | 超时 30s，沙箱路径检查 |
| `run_tests` | `child_process.exec("npm test")` | `false` | 只验证不修改代码 |

### 3.5 治理护栏 ⭐（重点深入维度）

三层架构：**RuleGuard → SandboxGuard → HITLGuard**

**RuleGuard**：预定义规则表，精确规则 HashMap 匹配，模式规则 glob/regex 匹配。
- 默认规则：`rm -rf /*` → deny, `DROP TABLE` → deny, `DELETE FROM` → deny, `git push` → ask（升级 HITL）, `.env` → deny, `/etc/*` → deny
- 输出：`{ verdict: "allow" | "deny" | "ask", matchedRule?: string }`

**SandboxGuard**：三维度边界检查。
- 路径：`path → resolve(normalize) → canonical → 判断是否在 allowedPaths 下 → allow/deny`
- 命令：匹配 `bannedCommands` 列表
- 超时：shell 命令默认 30s，超时 kill + 回灌错误
- 大小：读/写文件不超过 `maxFileSize`

**HITLGuard**：状态机 `IDLE → WAITING → APPROVED/DENIED`。
- 支持注入 `Approver` 接口：`InteractiveApprover`（真实交互式终端）和 `StubApprover`（测试用自动决策）
- 仅当 RuleGuard 返回 "ask" 时进入此层

### 3.6 反馈闭环（FeedbackLoop）

**职责边界**：`run_tests` 工具与 `FeedbackLoop` 是两个独立机制。

- **`run_tests` 工具**：Agent 主动请求运行测试（LLM 决策"我需要跑测试验证一下"），属于 ToolDispatcher 管理的工具，执行后结果作为 ToolResult 回灌
- **`FeedbackLoop`**：Harness 在代码变更后**自动**触发 Sensor 管道（测试/lint/类型检查），不受 Agent 控制，是 harness 层面的"安全网"

触发条件：`action.changedCode === true`（仅 `write_file` 默认触发，`shell` 检测工作区变化后判定）

**Sensors**：
- `TestSensor`：运行 `npm test`，解析通过/失败/失败数
- `LintSensor`：运行 `npm run lint`，同上
- `TypeCheckSensor`：运行 `npm run typecheck`，同上
- 每个 Sensor 分 `run()`（执行）和 `parse()`（解析）两步，各自可独立单测

**回灌格式**：`[反馈] 测试结果：N 个测试失败\n- path:line — 错误详情\n\n请检查并修正。`

**MockSensor**：支持注入预设的失败结果，用于 A.6② 演示——无需真实代码库即可测试反馈闭环。

### 3.7 记忆系统（最低实现）

- **存储**：JSON 文件，`~/.noopcoder/memory/` 目录
- **检索**：匹配 `goal` 关键词，拼接相关文件内容
- **写入**：会话结束时，从 Action 历史 + ToolResult 中提取关键决策写入持久文件（不新增 Action 类型，使用 Agent 运行过程中已产生的结构化数据）
- **固化**：`Memory.consolidate(context)` 在会话结束时调用，提取 `goal`、`summary`、`decisions` 存入 `MemoryEntry` 格式
- 标注为"最低可运行实现"，不影响护栏这个重点维度

### 3.8 配置系统

```typescript
interface Config {
  guardRules: GuardRule[];
  sandbox: SandboxPolicy;
  llm: { provider, model, apiEndpoint, temperature, maxTokens };
  run: { maxSteps, timeoutMs, maxConsecutiveFailures, contextLimit };
  sensors: string[];
}
```

- 从 `~/.noopcoder/config.json` 加载
- 启动时自动加载项目目录下的 `CLAUDE.md` / `AGENTS.md` 作为规则文件

### 3.9 凭据管理（CredentialManager）

- `getApiKey()`：从 OS 钥匙串读取，不回显明文
- `setApiKey(key)`：引导用户隐藏输入，写入安全存储
- `hasKey()`：检查是否已配置
- `clearApiKey()`：清除已存储的 key
- 实现方案：Windows Credential Manager（`keytar` 或 `wincred-native`），不硬编码、不提交 Git、不写入日志

---

## 4. 非功能性需求

### 4.1 性能
- 每个工具调用应在 30s 内完成（沙箱超时）
- LLM API 调用超时 60s
- 上下文窗口管理：token 超限时自动压缩

### 4.2 安全（含凭据威胁模型）

**威胁模型**：
| 威胁 | 对策 |
|------|------|
| API Key 泄露到 Git | `.env` 和 `*.key` 加入 `.gitignore`；key 不存文件，走 OS 钥匙串 |
| API Key 泄露到日志 | 日志输出前过滤 key 字符串 |
| API Key 通过 `shell` 命令泄露 | `env` / `export` 等命令加入默认规则 deny |
| 路径穿越攻击 | SandboxGuard 路径规范化（resolve → normalize → canonical） |
| 危险 shell 命令 | RuleGuard 拦截 `rm -rf`、`DROP TABLE` 等 |
| `.env` 文件被读写 | SandboxGuard 路径规则 deny `.env` |

**安全存储**：Windows Credential Manager（Windows 11 原生），keytar 为跨平台备选。

### 4.3 可用性
- 首次运行自动引导录入 API Key（隐藏输入）
- 提供 `--help` 和 `--version` 命令
- 错误信息明确、可操作

### 4.4 可观测性
- 每一步记录（action + result）到 trace 日志
- 可选 `--verbose` 模式输出完整上下文

---

## 5. 系统架构

```
  ┌──────────┐
  │   CLI    │   ← noopcoder "fix the bug in src/utils.ts"
  └────┬─────┘
       ↓ goal string
  ┌──────────────────────────────────────────────────────────┐
  │                    Agent Main Loop                        │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
  │  │  LLM     │→ │  Guard   │→ │  Tool    │→ │Feedback  │ │
  │  │  Client  │  │ Pipeline │  │Dispatcher│  │  Loop    │ │
  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
  │       │              │              │              │       │
  │       ↓              ↓              ↓              ↓       │
  │  OpenAICompat-   RuleGuard      GlobTool       TestSensor │
  │  ibleClient      SandboxGuard   GrepTool       LintSensor │
  │  MockLLMClient   HITLGuard      ReadFile       TypeCheck  │
  │                  (Approver)     WriteFile                  │
  │                                 ShellTool                  │
  │                                 TestTool                   │
  └──────────────────────────────────────────────────────────┘
       │                    │                    │
       ↓                    ↓                    ↓
  ┌──────────┐  ┌──────────────┐  ┌──────────────┐
  │  Memory  │  │   Config     │  │ Credential   │
  │ (JSON)   │  │  (JSON)      │  │  Manager     │
  └──────────┘  └──────────────┘  └──────────────┘
```

**外部依赖**：
- LLM 供应商：njusehub.info `/v1`（OpenAI 兼容），默认模型 GLM-5.2
- 文件系统：Node.js `fs` 模块
- Shell：Node.js `child_process`
- 凭据：Windows Credential Manager
- 无 agent 编排框架依赖（LangChain、AutoGen、CrewAI 等均不使用）

---

## 6. 数据模型

### 核心实体

**Message**：
```
{ role: "system" | "user" | "assistant", content: string }
```

**Action**（见 §3.3）

**ToolResult**：
```
{ success: boolean, output: string, action: Action, changedCode: boolean, error?: string }
```

**GuardResult**：
```
{ verdict: "allow" | "deny" | "ask", reason?: string, matchedRule?: string }
```

**Feedback**：
```
{ hasFailures: boolean, message: string, failureCount: number, failures: FailureDetail[] }
```

**AgentResult**：
```
{ status: "success" | "timeout" | "max_steps" | "failure", summary: string, steps: number }
```

**MemoryEntry**：
```
{ id: string, timestamp: string, goal: string, summary: string, decisions: string[] }
```

---

## 7. 凭据与分发设计

### 7.1 凭据存储

- **方案**：Windows Credential Manager（通过 `wincred-native` 或 `keytar` 库）
- **录入**：首次运行 `noopcoder setup` → 隐藏输入 API Key → 写入 Credential Manager
- **查看**：`noopcoder status` → 显示 "API Key 已配置（xxxxxxxx-xxxx）"，不回显明文
- **更新**：`noopcoder setup` 重新录入
- **清除**：`noopcoder clear` → 从 Credential Manager 删除

### 7.2 分发（Docker）

- **Dockerfile**：基于 `node:20-alpine`，`npm install && npm run build`
- **运行**：`docker build -t noopcoder . && docker run -it noopcoder`
- **Key 配置**：通过环境变量 `NOOPCODER_API_KEY` 注入（Docker 容器内唯一方案）
- **已知限制**：沙箱路径限制在容器内生效；Windows Credential Manager 在容器内不可用，容器内统一使用环境变量

---

## 8. 技术选型与理由

| 项目 | 选择 | 理由 |
|------|------|------|
| 编程语言 | TypeScript | 类型安全，Node.js 文件/Shell 操作天然友好，生态丰富 |
| 运行时 | Node.js 20+ | LTS，稳定 |
| LLM 供应商 | njusehub.info + GLM-5.2 | 课程提供 300 元额度，OpenAI 兼容接口 |
| LLM 调用方式 | 纯文本 JSON 输出 | 厂商无关，不依赖 function calling，解析逻辑可独立单测 |
| 凭据存储 | Windows Credential Manager | 课程要求"至少一种安全存储"，Windows 原生 |
| 分发 | Docker | 通用、跨平台、CI 友好、部署简单 |
| 测试框架 | Jest | TypeScript 生态标准，mock 支持好 |
| 包管理 | npm | 与 Node.js 配套 |

**不使用**：LangChain AgentExecutor、AutoGen、CrewAI、LlamaIndex agent、任何 agent 框架的高层编排循环。

**允许使用**：OpenAI SDK（仅用于 HTTP 调用层）、keytar/wincred-native（凭据存储）、Jest（测试）、fs/child_process（Node.js 内置）。

---

## 9. 领域与机制设计（A.5 额外要求）

### 领域（Coding）

**反馈信号**：
- 测试结果（pass/fail，失败数，失败位置）
- Lint 结果（warning/error，位置）
- 类型检查结果（TypeScript `tsc` 错误）
- 这些信号**客观、确定、可回灌**——不依赖 LLM 的主观判断

**危险动作**：
- 危险 shell 命令：`rm -rf`、`DROP TABLE`、`DELETE FROM`、`git push --force`、`chmod 777`、`curl | bash`
- 文件操作越界：读取项目目录外的文件、写入 `.env` 等敏感文件
- 对外发布：`npm publish`、`git push`（升级到 HITL）

**所需工具**：glob（浏览文件结构）、grep（搜索代码）、read_file、write_file、shell、run_tests——覆盖 coding 场景的完整闭环

**记忆需求**：项目约定（CLAUDE.md 等规则文件）、历史决策（跨会话固化）、上下文窗口压缩（token 超限时）

### 重点维度：治理护栏

**为什么选治理**：
1. 天然由代码构成——护栏是 `guardrail(action)` 函数，不是提示词
2. 最易写出确定性单测——`guardrail({type:"shell", command:"rm -rf /"})` → deny，每次成立
3. 课程明确推荐——"建议作为重点的维度：治理（护栏/沙箱/HITL 状态机/范围围栏）"
4. 工程深度可量化——三层架构 + 路径规范化 + HITL 状态机，形成了完整的安全防线

**如何编码实现**（呼应 §A.4）：
- RuleGuard：规则表 + HashMap 匹配，代码级判定，不依赖 LLM
- SandboxGuard：路径规范化（resolve → normalize → canonical），确定性路径检查
- HITLGuard：状态机，可注入 stub Approver 做离线测试
- 三层全部可 mock 单测，满足 A.4(C) 硬标准

---

## 10. 验收标准

| 功能 | 验收标准 |
|------|----------|
| Agent 主循环 | MockLLM 输入 3 个 action 序列，Agent 正确执行全部并返回 success |
| 护栏拦截 | `RuleGuard.check({type:"shell", command:"rm -rf /"})` → `{verdict:"deny"}` |
| 路径穿越 | `SandboxGuard.check({type:"read_file", path:"/project/../etc/passwd"})` → `{verdict:"deny"}` |
| 反馈闭环 | MockLLM 写坏代码 → MockSensor 报失败 → Agent 改变下一步行为 |
| 停机判断 | maxSteps=3，MockLLM 返回 4 个非 done action → `{status:"max_steps"}` |
| 凭据安全 | 代码中无硬编码 key；`.env` 和 `*.key` 在 `.gitignore` 中 |
| 分发 | `docker build && docker run` 可启动 |
| CI | GitHub Actions 有 unit-test job，最后一次 push 为绿色 |
| Mock 单测 | `npm test -- --mock` 无网络、无真实 LLM，全部通过 |
| 机制演示 | 一键脚本复现 ①护栏拦截 ②反馈闭环 ③路径穿越防护 |

---

## 11. 风险与未决问题

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| GLM-5.2 对 JSON 输出格式遵循不稳定 | agent 解析失败率高 | 重试机制 + 系统提示词约束 + 回灌错误信息 |
| 300 元额度可能不够多次迭代 | 开发中断 | 优先用 MockLLM 开发核心机制，真实 LLM 仅用于集成测试 |
| Windows Credential Manager 在容器内不可用 | 分发安全降级 | 容器内统一使用环境变量注入，README 说明 |
| 时间紧迫（3 天） | 某些功能无法深入 | 记忆/配置标注"最低实现"，专注护栏这个重点维度 |
| Codex 冷启动验证可能再出问题 | 延期 | 已回退版本，预留备用方案（Cursor/Gemini CLI） |

---

*设计文档结束。下一步：writing-plans 生成 PLAN.md。*