# SPEC_PROCESS — 头脑风暴与设计决策过程

> 本文档记录 NoOpCoder 项目的完整设计过程，从需求分析到架构定稿。
> 生成时间：2026-08-13

---

## 1. 需求分析阶段

### 1.1 初始输入

项目启动时，输入了三份文档：
- **AI4SE 期末项目通用要求** — 课程层面的通用规范（验收标准、文档要求、提交物清单）
- **AI4SE Final Project A · Coding Agent Harness** — A 类具体需求（6 大维度、3 层护栏、Mock 测试、Docker 分发）
- **任务描述** — 用户明确选择 A 类，要求从零实现，不上 GitHub 找半成品

### 1.2 关键决策：技术栈选择

**问题**：选 Python 还是 TypeScript？

| 维度 | Python | TypeScript |
|------|--------|------------|
| 文件/Shell 操作 | 标准库可用 | 标准库丰富 |
| 类型安全 | 动态类型 | 静态类型 |
| 与 LLM 生态 | 生态最丰富 | 也有 OpenAI SDK |
| 项目规模 | 适合 200 行级 | 适合 2000 行级 |
| 团队熟悉度 | 用户熟悉 | 用户熟悉 |

**决策**：TypeScript + Node.js 20+。理由：文件操作、Shell 执行、类型安全、Jest 测试生态均优于 Python。项目规模在 2000 行左右，TypeScript 的类型系统能有效降低集成 bug。

### 1.3 关键决策：重点维度选择

**问题**：6 个维度中哪个作为重点深入维度？

课程要求必选一个维度深入，建议"治理（护栏/沙箱/HITL 状态机/范围围栏）"。

**决策**：**治理护栏**。理由：
1. 天然由代码构成——护栏是 `guardrail(action)` 函数，不是提示词
2. 最容易写出确定性单测——`guardrail({type:"shell", command:"rm -rf /"}) → deny`，每次成立
3. 三层架构（规则 → 沙箱 → 人工确认）形成了完整的安全防线，有深度可量化
4. 课程明确推荐作为重点维度

### 1.4 关键决策：分发方式

**问题**：Docker 还是 npm 包？

**决策**：Docker。理由：Docker 是通用方案，跨平台，CI 友好，部署简单，与课程要求的"线上部署 + 提供 URL"天然匹配。

---

## 2. 架构设计阶段

### 2.1 核心命题确认

**Agent = LLM + Harness**。LLM 只占一行任务决策，其余全是工程。这个命题指导了所有设计决策——每个模块必须是可独立测试的工程组件，不能依赖 LLM 的"智能"。

### 2.2 六维架构设计

六个维度逐一设计：

```
1. 决策封装 → Agent 主循环 + 停机判断
2. 动作/工具 → 6 个内置工具 + ToolDispatcher
3. 治理护栏 → RuleGuard → SandboxGuard → HITLGuard（重点维度）
4. 反馈闭环 → TestSensor + LintSensor + TypeCheckSensor
5. 记忆系统 → FileMemory（最低实现）
6. 配置系统 → 声明式规则 + 用户覆盖
```

### 2.3 设计反馈与迭代（关键设计修正）

用户提供了多轮设计反馈，以下是最关键的修正：

#### 第一轮反馈（6 项）

| 反馈 | 原始设计 | 修正后 |
|------|----------|--------|
| HITL 应在护栏管道内 | HITL 在工具执行后 | HITL 在 GuardPipeline 内，RuleGuard 之后 |
| 反馈只触发在 changedCode | 每次工具调用后都触发 | 仅在 `result.changedCode === true` 时触发 |
| 停机条件明确 | 只有 done | 4 种条件：done / maxSteps / timeout / maxConsecutiveFailures |
| 沙箱资源限制 | 仅路径检查 | 增加 maxFileSize、timeoutMs |
| HITL 测试模式 | 未设计 | 新增 StubApprover 接口 |
| 记忆最低实现 | 计划较复杂 | 砍掉 take_note，仅保留 consolidate + retrieve |

#### 第二轮反馈（5 项）

| 反馈 | 原始设计 | 修正后 |
|------|----------|--------|
| `parsedAction` 不应在 LLMResponse | 在 LLMResponse 中 | 分离到 ActionParser |
| 缺少 `glob` 和 `grep` 类型 | 只有 read/write/shell | 增加 glob 和 grep 动作类型 |
| MockLLM 应接受完整 Action 对象 | 只接受 type 字符串 | 接受完整 Action 对象 |
| 纯 JSON 文本输出 | function calling | 纯文本 JSON，不依赖 function calling |
| finishReason 处理细化 | 简单处理 | stop / length / error 三种不同处理 |

#### 第三轮反馈（5 项）

| 反馈 | 原始设计 | 修正后 |
|------|----------|--------|
| run_tests changedCode = false | 未标注 | 明确 test 工具不修改代码 |
| 移除 O(1) 匹配声明 | 声称 HashMap O(1) | 改为"HashMap 精确匹配 + glob/regex 模式匹配" |
| 路径规范化流程 | 简单路径检查 | resolve → normalize → canonical 三步 |
| Guard 和 Dispatcher 分离 | 可能耦合 | 明确分离为两个独立组件 |
| OpenAI 客户端命名 | 平台相关 | 改为 `OpenAICompatibleClient`（厂商无关） |

#### 第四轮反馈（4 项）

| 反馈 | 原始设计 | 修正后 |
|------|----------|--------|
| ToolResult 增加 changedCode 字段 | 无 | 新增 `changedCode: boolean` |
| 演示深度不足 | 简单示例 | 三个场景 + 确定性验证 |
| 凭据管理安全性 | 文件存储 | 增加 `0600` 权限 + 环境变量兜底 |
| ActionParser 定义位置 | 分散 | 统一在 `action/` 模块 |

---

## 3. 实现计划阶段

### 3.1 任务分解

将整个实现分解为 26 个任务，分布在 10 个 Phase 中：

| Phase | 任务数 | 内容 |
|-------|--------|------|
| Phase 1: Setup | T1 | 项目脚手架 |
| Phase 2: Types | T2-T3 | Action 类型 + ActionParser |
| Phase 3: LLM | T4-T6 | LLMClient 接口 + MockLLM + OpenAI 兼容客户端 |
| Phase 4: Tools | T7-T11 | 工具接口 + 6 个工具实现 |
| Phase 5: Guard | T12-T15 | 三层护栏（重点维度） |
| Phase 6: Feedback | T16-T18 | 反馈闭环 |
| Phase 7: Memory | T19-T21 | 记忆 + 配置 + 凭据 |
| Phase 8: Agent | T22-T23 | 上下文 + Agent 主循环 |
| Phase 9: CLI | T24 | CLI 入口 |
| Phase 10: Demo | T25-T26 | 演示脚本 + Docker/CI/README |

### 3.2 并行任务分组

设计 5 个并行组，使用 Git worktree 隔离开发：

- **Group A** (T4-T6): LLM 层
- **Group B** (T7-T11): 工具层
- **Group C** (T12-T15): 护栏层（重点）
- **Group D** (T16-T18): 反馈层
- **Group E** (T19-T21): 记忆/配置/凭据

### 3.3 方法论选择

采用 **Superpowers** 方法论：brainstorming → writing-plans → subagent-driven-development → TDD → code-review → finish。

每个任务要求 TDD（Red → Green → Refactor），所有核心机制必须通过 MockLLM 测试，不依赖真实网络。

---

## 4. 关键设计决策记录

### D1: 为什么不用 function calling？

**决策**：使用纯文本 JSON 输出。

**理由**：保持厂商无关性。如果使用 function calling，就绑定到 OpenAI 格式。GLM-5.2 在 njusehub.info 上虽然兼容 OpenAI 格式，但纯文本 JSON 解析的逻辑更简单、可独立单测、不依赖 SDK 行为。

### D2: 为什么 feedback 不在工具内？

**决策**：FeedbackLoop 是 harness 层面的独立组件，不在 Tool 内部。

**理由**：工具只负责执行动作（读写文件、运行命令），反馈是 harness 对代码质量的检测。如果将反馈逻辑放在工具内部，就违反了"工具是 stateless executor"的设计原则。

### D3: 为什么 GuardPipeline 是 RuleGuard → HITL → SandboxGuard？

**决策**：先规则匹配（快速拒绝），再人工确认（仅对"ask"规则），最后沙箱边界检查。

**理由**：RuleGuard 是 O(n) 规则匹配，最快；HITL 需要人工交互，耗时最长，但只在"ask"时才触发；SandboxGuard 做路径规范化，可能涉及文件系统调用。按计算成本从小到大排列，最小化延迟。

### D4: 为什么 CredentialManager 最终用文件存储而不是 Windows Credential Manager？

**决策**：文件存储 + 0600 权限 + Docker 环境变量兜底。

**理由**：`keytar`/`wincred-native` 依赖原生模块，在 Windows 11 上安装复杂，且在 Docker 容器内不可用。最终方案是：本地用 `~/.noopcoder/credentials` 文件（0600 权限），Docker 用环境变量 `NOOPCODER_API_KEY`。这是"适度安全"的务实选择。

---

## 5. 风险识别与缓解

| 风险 | 缓解措施 |
|------|----------|
| GLM-5.2 JSON 输出不稳定 | 重试机制 + 系统提示词约束 + 回灌错误信息 |
| 300 元额度不够 | 优先 MockLLM 开发，真实 LLM 仅用于集成测试 |
| 时间紧迫（3 天） | 记忆/配置标注"最低实现"，专注护栏维度 |
| 路径穿越测试不充分 | resolve → normalize → canonical 三步确保 |
| Windows 中文路径问题 | 使用绝对路径，避免 shell 依赖 |

---

## 6. 总结

整个设计过程经历了：
1. **需求分析**（1 轮）→ 明确 A 类、TypeScript、治理护栏重点
2. **架构设计**（4 轮反馈迭代）→ 从初始架构到最终定稿，修正了 20+ 处设计
3. **实现计划**（1 轮）→ 26 个任务、10 个 Phase、5 个并行组
4. **执行**（1 轮开发）→ 全部 26 个任务完成，70 个测试通过

设计过程中最关键的认知转变是：**Agent = LLM + Harness** 不是一个口号，而是工程实践——每个模块都必须做到"不需要 LLM 也能测试、不需要 LLM 也能理解"。

---

## 7. 冷启动验证（§4.5）

> 验证时间：2026-08-14
> 验证 Agent：Codex（GPT-5），与主开发 Agent（Claude Code）不同

### 7.1 验证方法

由于 PLAN.md 中 Phase 2-7 的所有 task 在仓库中均已标记为 `[x]` 完成，且 `src/` 已有完整实现，没有"待实现"的 task。为忠实模拟冷启动（SPEC+PLAN 是唯一输入），最终选择了 **Task 12（RuleGuard）** 进行"从零重推导"验证：

- 仅阅读 SPEC §3.5/§9/§4.1/§10 和 PLAN Task 12
- 刻意不读现有 `src/guard/rule-guard.ts`
- 在独立 `coldstart/` 目录中走完整 TDD：先写 5 个失败测试（RED）→ 写实现 → 5/5 通过（GREEN）
- 随后将从头推导的版本与现有参考实现逐行对比

### 7.2 验证结果

**结论**：行为能复现（5/5 测试的功能均正确），但**类型契约无法从文档确定**，多处需靠猜测。

### 7.3 发现的 SPEC 缺陷

| # | 缺陷 | 影响 | 严重程度 |
|---|------|------|----------|
| 1 | **GuardResult 字段名未定义**：§6 只点名 GuardResult，不定义字段。Codex 猜 `{decision, reason, ruleId}`，实际是 `{verdict, reason, matchedRule}`。 | 任何消费 GuardResult 的代码（Agent 主循环、GuardPipeline）都会因猜错字段名而断裂 | 🔴 高 |
| 2 | **GuardRule 形状未定义**：§3.5/§9 不定义 GuardRule 记录字段。Codex 猜 `{id, actionType, commandContains, pathContains, decision}`，实际是 `{pattern, matchOn, action}` | 冷启动 agent 需要凭空猜测类型定义 | 🔴 高 |
| 3 | **"HashMap 匹配"有误导性**：§9 写"RuleGuard：规则表 + HashMap 匹配"，但 HashMap 是精确键查找，而测试需要匹配命令变体（`rm -rf /`、`DROP TABLE users;`），精确查找做不到。实际实现用的是子串 `.includes()` | 照 §9 字面实现会直接挂掉测试 | 🟡 中 |
| 4 | **匹配语义未规定**：§3.5/§9 没说大小写敏感、子串/正则/精确。Codex 选了大小写不敏感子串，实际是大小写敏感子串。给定测试都过，但小写输入行为会分叉 | 边界情况行为不一致 | 🟡 中 |
| 5 | **Action 字段形状未定义**：§3.3 只列 Action 联合类型名，不给字段。`ShellAction.command`、`WriteFileAction.path/content` 都得靠 §4.1/§3.4 反推 | 冷启动 agent 需要从分散的文档中拼凑类型定义 | 🟡 中 |
| 6 | **"ask" 的归属未说清**：§3.5 顺序是 RuleGuard → SandboxGuard → HITLGuard，HITLGuard 拥有 IDLE→WAITING 状态机；但 PLAN 把 "git push → ask" 放在 RuleGuard。RuleGuard 返回 ask 后由谁提示、是否流转到 HITLGuard，SPEC 没写 | 冷启动 agent 不知道该在哪里处理 ask | 🟡 中 |
| 7 | **`.env` 归属 SPEC↔PLAN 矛盾**：SPEC §4.1 把 `.env` 防护归给 SandboxGuard（"SandboxGuard 路径规则 deny"），但 PLAN Task 12 把 "deny .env" 列为 RuleGuard 测试。实际实现按 PLAN 放在 RuleGuard，与 SPEC 冲突 | 照 SPEC 实现的 agent 会把 `.env` 放进 SandboxGuard，过不了 PLAN Task 12 的测试 | 🟡 中 |

### 7.4 发现的 PLAN 缺陷

| # | 缺陷 | 影响 | 严重程度 |
|---|------|------|----------|
| 1 | **所有 task 预标 [x] 且实现已存在**：冷启动 agent 没有开放 task，"实现它"的指令与仓库现状冲突 | 冷启动第一步就阻塞——不知道该重实现、验证还是跳过 | 🔴 高 |
| 2 | **Task 12 测试清单不完整**：PLAN 只列 5 条规则（rm -rf / DROP TABLE / git push / .env / safe），实际实现额外包含 DELETE FROM、/etc/、npm publish | 冷启动 agent 无法从 PLAN 得知完整规则集 | 🟡 中 |
| 3 | **Task 12 写 "Guard types" 但不枚举**：实际类型文件还包含 SandboxPolicy，PLAN/SPEC 都没暗示它的存在 | 类型设计不完整 | 🟢 低 |

### 7.5 其他发现

- **SPEC.md 编码问题**：在中文 Windows 上，PowerShell 默认 `Get-Content` 读取 SPEC.md 显示为乱码（GBK 解码 UTF-8）。需加 `-Encoding UTF8` 参数。文件本身是合法 UTF-8，不是文件缺陷，但在中文 Windows 默认工具链下是真实卡点，冷启动 agent 第一步就可能踩坑。

### 7.6 修订建议

1. **SPEC.md**：在 §6 数据模型中加入 GuardResult 和 GuardRule 的完整字段定义
2. **SPEC.md**：§9 "HashMap 匹配" 改为 "子串匹配 + 可扩展的匹配策略"
3. **SPEC.md**：明确 "ask" 的流转路径：RuleGuard 返回 ask → HITLGuard 处理
4. **SPEC.md**：统一 `.env` 防护的归属（RuleGuard 或 SandboxGuard，二选一）
5. **PLAN.md**：冷启动验证前，至少留 1 个 task 未勾选，或注明"可重推导复现"