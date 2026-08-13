# SPEC: Coding Agent Harness — NoOpCoder

> 设计文档，由 brainstorming 产出。项目代号 "NoOpCoder"。
> 完整要求 = 本文件 + 《AI4SE 期末项目 · 通用要求》+ 《AI4SE Final Project A · Coding Agent Harness》

---

## 1. 问题陈述

**要解决的问题**：当 LLM 能完成大部分编码思考时，我们需要一个工程化的运行环境（harness），将 LLM 的"下一步决策"封装成稳定、可靠、可治理的编码智能体。本项目交付一个从零实现的 Coding Agent Harness 内核，而非对现成 agent 框架的配置封装。

**目标用户**：需要辅助编码的开发者，以及需要理解 Agent = LLM + Harness 这一方法论的 AI4SE 研究者。

**核心命题**：Agent = LLM + Harness。LLM 只占一行任务决策，其余全是工程。本项目用编码实现这套工程，再用 mock/单测验证它。

---

## 2. 用户故事

1. **作为开发者**，我想要一个 CLI 工具能接收我的编码需求，自动读写文件、执行命令，并返回完成结果，而不是手动一步步操作。
2. **作为安全敏感的用户**，我希望 agent 在执行 `rm -rf /` 或 `DROP TABLE` 这类危险命令之前被自动拦截，而不是靠 LLM 自觉。
3. **作为调试者**，我希望 agent 在写完代码后自动运行测试，如果测试失败，agent 能根据失败信息自我修正，而不是带着 bug 继续。
4. **作为学习者**，我希望 harness 的每一个核心机制（护栏、反馈、工具分发）都能用 mock LLM 做确定性单测，离线理解其工作原理。
5. **作为运维者**，我希望能通过声明式配置文件来定制 agent 的行为，而不需要修改 harness 源代码。
6. **作为新用户**，我希望首次运行时有引导流程帮我安全录入 API Key，且 Key 不会被明文写入日志、历史记录、或提交到 Git。
7. **作为课程助教**，我希望能一键运行机制演示脚本，在无需网络的环境下看到护栏拦截、反馈闭环、路径穿越防护三个场景的确定性复现。

---

## 3. 功能规约

### 3.1 Agent 主循环

| 项目 | 内容 |
|------|------|
| **输入** | 用户目标（自然语言字符串） |
| **行为** | 构建上下文 → 调用 LLM → 解析动作 → 护栏检查 → 工具执行 → 反馈回灌 → 循环 |
| **输出** | `AgentResult { status, summary, steps }` |
| **停机条件** | (1) LLM 返回 `done`; (2) 达到 maxSteps; (3) 超时; (4) 熔断 |
| **错误处理** | 解析失败 → 重试; API 调用失败 → 重试; 工具失败 → 不计入 succeeded |

### 3.2 LLM 抽象层

- **RealLLMClient**：`OpenAICompatibleClient`，对接 OpenAI 兼容 API
- **MockLLMClient**：接受预设 Action 数组，按序返回

### 3.3 Action 协议

```typescript
type Action = GlobAction | GrepAction | ReadFileAction | WriteFileAction
            | ShellAction | RunTestsAction | DoneAction;
```

### 3.4 工具分发（ToolDispatcher）

| 工具 | changedCode |
|------|-------------|
| `glob` | false |
| `grep` | false |
| `read_file` | false |
| `write_file` | true |
| `shell` | 检测工作区变化 |
| `run_tests` | false |

### 3.5 治理护栏 ⭐（重点深入维度）

三层架构：**RuleGuard → SandboxGuard → HITLGuard**

- **RuleGuard**：预定义规则表，匹配命令/路径/动作类型
- **SandboxGuard**：路径规范化（resolve → normalize → canonical），防御穿越攻击
- **HITLGuard**：状态机 `IDLE → WAITING → APPROVED/DENIED`，支持 Approver 注入

### 3.6 反馈闭环

- **触发条件**：`changedCode === true` 时自动触发 Sensor 管道
- **Sensors**：`TestSensor`、`LintSensor`、`TypeCheckSensor`
- **MockSensor**：注入预设结果，用于离线演示

### 3.7 记忆系统（最低实现）

- JSON 文件持久化，关键词匹配检索

### 3.8 配置系统

- `~/.noopcoder/config.json` 加载，含默认值 + 用户覆盖

### 3.9 凭据管理

- `CredentialManager`：`setup`/`status`/`clear` 命令
- 文件存储 `~/.noopcoder/credentials`（0600 权限）
- 环境变量 `NOOPCODER_API_KEY` 优先

---

## 4. 非功能性需求

### 4.1 安全（含凭据威胁模型）

| 威胁 | 对策 |
|------|------|
| API Key 泄露到 Git | `.gitignore` 排除，key 不提交 |
| API Key 泄露到日志 | 显示仅首尾 4 字符 |
| 路径穿越攻击 | SandboxGuard 路径规范化 |
| 危险 shell 命令 | RuleGuard 拦截 |
| `.env` 文件被读写 | SandboxGuard 路径规则 deny |

### 4.2 可用性
- 首次运行 `noopcoder setup` 引导录入
- 查看状态 `noopcoder status` 不回显明文
- 清除 `noopcoder clear`

---

## 5. 系统架构

```
CLI → Agent 主循环 → (LLMClient → ActionParser → GuardPipeline → ToolDispatcher → FeedbackLoop)
                                   ↓                    ↓               ↓
                              OpenAI Compatible    RuleGuard         TestSensor
                              MockLLMClient        SandboxGuard      LintSensor
                                                   HITLGuard         TypeCheckSensor
```

**外部依赖**：Node.js 20+, OpenAI SDK, Docker

---

## 6. 数据模型

核心实体：`Message`, `Action`, `ToolResult`, `GuardResult`, `Feedback`, `AgentResult`, `MemoryEntry`

---

## 7. 凭据与分发设计

### 7.1 凭据存储
- **本地**：`~/.noopcoder/credentials`（0600 权限），`noopcoder setup` 隐藏输入录入
- **Docker**：环境变量 `NOOPCODER_API_KEY` 注入

### 7.2 分发（Docker）
- `Dockerfile` 基于 `node:20-alpine`
- `docker build -t noopcoder . && docker run -it -e NOOPCODER_API_KEY=sk-xxx noopcoder run "任务"`

---

## 8. 技术选型与理由

| 项目 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | 类型安全，Node.js 生态 |
| 运行时 | Node.js 20+ | LTS |
| LLM 供应商 | OpenAI 兼容 API | 厂商无关 |
| 分发 | Docker | 跨平台、CI 友好 |
| 测试 | Jest | TypeScript 生态标准 |

---

## 9. 领域与机制设计（A.5 额外要求）

### 重点维度：治理护栏

**为什么选治理**：
1. 天然由代码构成，不是提示词
2. 最易写出确定性单测
3. 工程深度可量化——三层架构 + 路径规范化 + HITL 状态机

**如何编码实现**：
- RuleGuard：规则表 + HashMap 匹配
- SandboxGuard：路径规范化，确定性路径检查
- HITLGuard：状态机 + stub Approver
- 三层全部可 mock 单测

---

## 10. 验收标准

| 功能 | 标准 |
|------|------|
| Agent 主循环 | MockLLM 3 个 action → 全部执行返回 success |
| 护栏拦截 | `rm -rf /` → deny |
| 路径穿越 | `/project/../etc/passwd` → deny |
| 反馈闭环 | 写坏代码 → MockSensor 报失败 → 修正 |
| 凭据安全 | 无硬编码 key，无提交 |
| Docker | `docker build && docker run` 可启动 |
| CI | GitHub Actions unit-test job 绿色 |
| 机制演示 | 一键脚本 3/3 通过 |

---

## 11. 风险与未决问题

| 风险 | 缓解 |
|------|------|
| LLM JSON 输出格式不稳定 | 重试 + 回灌错误信息 |
| 300 元额度不足 | 优先 MockLLM 开发 |
| 时间紧迫 | 记忆/配置标注最低实现，专注护栏维度 |