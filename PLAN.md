# NoOpCoder Implementation Plan

**Goal:** Build a coding agent harness (CLI tool) that wraps an LLM into a governed, self-correcting coding agent — with mock-LLM testability, Docker distribution, and a mechanism demo.

**Tech Stack:** TypeScript, Node.js 20+, Jest, OpenAI-compatible HTTP API, Docker

## Global Constraints

- **No agent frameworks:** No LangChain, AutoGen, CrewAI, or any agent runner SDK
- **TDD mandatory:** Red → Green → Refactor for every task
- **Mock-LLM testable:** Every harness mechanism testable with MockLLMClient, no network
- **Credentials:** API key never hardcoded, never in git, never in logs

---

## Phase 1: Project Setup

### Task 1: Initialize project scaffold
- [x] Create `package.json`, `tsconfig.json`, `jest.config.ts`, `.gitignore`
- [x] Create `src/` directory structure
- [x] Install dependencies and verify build
- **Commit:** `25a6c1e` (initial commit)

## Phase 2: Core Types & Interfaces

### Task 2: Define Action types and ToolResult
- [x] Create `src/action/types.ts` — Action union type, ToolResult interface
- [x] Tests: 4 smoke tests for type shapes
- **Commit:** `25a6c1e`

### Task 3: ActionParser
- [x] Create `src/action/action-parser.ts` — JSON extraction + validation
- [x] Tests: 7 tests (valid JSON, invalid JSON, unknown type, missing fields, extra text)
- **Commit:** `25a6c1e`

## Phase 3: LLM Abstraction Layer

### Task 4: LLMClient interface
- [x] Create `src/llm/types.ts` — LLMClient, Message, LLMConfig, LLMResponse
- **Commit:** `25a6c1e`

### Task 5: MockLLMClient
- [x] Create `src/llm/mock-llm-client.ts` — sequential action playback
- [x] Tests: sequence, exhaustion, usage data
- **Commit:** `25a6c1e`

### Task 6: OpenAICompatibleClient
- [x] Create `src/llm/openai-compatible-client.ts` — OpenAI SDK wrapper
- [x] Tests: mock HTTP, verify config propagation
- **Commit:** `25a6c1e`

## Phase 4: Tool System

### Task 7: Tool interface + ToolDispatcher
- [x] Create `src/tools/types.ts`, `src/tools/tool-dispatcher.ts`
- [x] Tests: dispatch to registered tool, throw for unregistered
- **Commit:** `25a6c1e`

### Task 8: GlobTool, GrepTool, ReadFileTool
- [x] Implement and test all three read-only tools
- **Commit:** `25a6c1e`

### Task 9: WriteFileTool
- [x] Implement and test
- **Commit:** `25a6c1e`

### Task 10: ShellTool
- [x] Implement with workspace change detection
- **Commit:** `25a6c1e`

### Task 11: TestTool
- [x] Implement and test
- **Commit:** `25a6c1e`

## Phase 5: Guard Pipeline ⭐ (Deep Dimension)

### Task 12: RuleGuard
- [x] Guard types, RuleGuard with command/path/action matching
- [x] Tests: deny rm -rf, deny DROP TABLE, ask git push, deny .env, allow safe
- **Commit:** `25a6c1e`

### Task 13: SandboxGuard
- [x] Path normalization (resolve → normalize → canonical)
- [x] Tests: allowed path, outside path, traversal, traversal nested, banned commands
- **Commit:** `25a6c1e`

### Task 14: Approver + HITLGuard
- [x] Approver interface, InteractiveApprover, StubApprover
- [x] HITLGuard state machine: idle → waiting → approved/denied
- **Commit:** `25a6c1e`

### Task 15: GuardPipeline
- [x] Orchestrate RuleGuard → HITL → SandboxGuard
- **Commit:** `25a6c1e`

## Phase 6: Feedback Loop

### Task 16: Sensor interface + MockSensor
- [x] Sensor types, MockSensor with preset output
- **Commit:** `25a6c1e`

### Task 17: TestSensor, LintSensor, TypeCheckSensor
- [x] Implement all three real sensors
- **Commit:** `25a6c1e`

### Task 18: FeedbackLoop
- [x] changedCode gate → sensor pipeline → feedback message
- **Commit:** `25a6c1e`

## Phase 7: Memory & Config

### Task 19: FileMemory
- [x] JSON file persistence, keyword-based retrieval
- **Commit:** `25a6c1e`

### Task 20: Config system
- [x] Default config + user overrides from `~/.noopcoder/config.json`
- **Commit:** `25a6c1e`

### Task 21: CredentialManager
- [x] Secure key storage, setup/status/clear commands
- **Commit:** `25a6c1e`

## Phase 8: Agent Main Loop

### Task 22: Context builder
- [x] Message builder with compression
- **Commit:** `25a6c1e`

### Task 23: Agent main loop
- [x] Full loop: context → LLM → parse → guard → dispatch → feedback → repeat
- [x] Stop conditions: done, max_steps, timeout, failure circuit breaker
- **Commit:** `25a6c1e`

## Phase 9: CLI

### Task 24: CLI entry point
- [x] `setup`, `status`, `clear`, `run` commands
- **Commit:** `25a6c1e`

## Phase 10: Integration & Demo

### Task 25: Mechanism demo scripts
- [x] Demo 1: Guardrail intercept (`rm -rf /` → deny)
- [x] Demo 2: Feedback loop (bad code → sensor → fix)
- [x] Demo 3: Path traversal (`/project/../etc/passwd` → deny)
- **Commit:** `25a6c1e`

### Task 26: Docker + CI + README
- [x] Dockerfile (node:20-alpine)
- [x] CI config (GitHub Actions, unit-test job)
- [x] README.md
- **Commit:** `25a6c1e`

## Post-Implementation Fixes

### Fix: CI credentials tracking
- [x] Remove `~/.noopcoder/credentials` from git tracking
- [x] Add `~/.noopcoder/` to `.gitignore`
- **Commit:** `f31bb1f`

### Fix: Cross-platform test for WriteFileTool
- [x] Replace Windows-specific `<invalid>` path test with directory path test
- **Commit:** `81612db`

---

## Task Dependency Graph

```
T1 (scaffold) → T2 (types) → T3 (parser)
T1 → T4 (llm types) → T5 (mock llm), T6 (openai client)
T1 → T7 (tool dispatcher) → T8 (glob/grep/read), T9 (write), T10 (shell), T11 (test)
T1 → T12 (rule guard) → T13 (sandbox guard) → T14 (hitl guard) → T15 (pipeline)
T1 → T16 (mock sensor) → T17 (real sensors) → T18 (feedback loop)
T1 → T19 (memory), T20 (config), T21 (credentials)
T22 (context) + T2-T21 → T23 (agent) → T24 (cli) → T25 (demo) → T26 (docker/ci)
```

## Verification

- `npm run test:mock` — 69/69 passed ✅
- `npm run build` — tsc succeeded ✅
- `npm run demo` — 3/3 passed ✅
- `docker build -t noopcoder .` — succeeded ✅
- GitHub Actions CI — green ✅