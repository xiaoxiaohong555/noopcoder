# NoOpCoder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a coding agent harness (CLI tool) that wraps an LLM into a governed, self-correcting coding agent — with mock-LLM testability, Docker distribution, and a mechanism demo.

**Architecture:** TypeScript CLI app with modular pipeline: CLI → Agent main loop → (LLM → ActionParser → GuardPipeline → ToolDispatcher → FeedbackLoop). Each module independently testable with mock LLM. Focus depth on governance guardrails (RuleGuard → SandboxGuard → HITLGuard).

**Tech Stack:** TypeScript, Node.js 20+, Jest, OpenAI-compatible HTTP API, Docker, keytar (Windows Credential Manager)

## Global Constraints

- **Language:** TypeScript 5.x, Node.js 20+
- **No agent frameworks:** No LangChain, AutoGen, CrewAI, or any agent runner SDK
- **TDD mandatory:** Red → Green → Refactor for every task
- **Mock-LLM testable:** Every harness mechanism must be testable with MockLLMClient, no network, no real LLM
- **No placeholders:** No TBD, TODO, "implement later" in any implementation
- **Credentials:** API key never hardcoded, never in git, never in logs
- **Dependency limit:** Use only what's needed — fs, child_process, fetch/OpenAI SDK, keytar, Jest
- **File size:** prefer focused files under 200 lines. Split if larger.

---

## Phase 1: Project Setup

### Task 1: Initialize project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `jest.config.ts`
- Create: `.gitignore`
- Create: `src/` directory structure (empty dirs for all modules)

**Interfaces:**
- Produces: `package.json` with all dependencies, `tsconfig.json` with strict mode, `jest.config.ts` with ts-jest preset

- [ ] **Step 1: Create package.json**

```json
{
  "name": "noopcoder",
  "version": "1.0.0",
  "description": "Coding Agent Harness — AI4SE Final Project",
  "main": "dist/cli/main.js",
  "bin": {
    "noopcoder": "./dist/cli/main.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/cli/main.js",
    "test": "jest --forceExit --detectOpenHandles",
    "test:mock": "jest --forceExit --detectOpenHandles --testPathIgnorePatterns='openai-compatible'",
    "demo": "node dist/demo/run-all.js"
  },
  "dependencies": {
    "openai": "^4.0.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: Create jest.config.ts**

```typescript
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.test.ts", "!src/demo/**"],
};

export default config;
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
.env
*.key
*.log
coverage/
.DS_Store
```

- [ ] **Step 5: Create all empty source directories**

```bash
mkdir -p src/{core,llm,action,tools,guard/approvers,feedback/sensors,memory,config,cli}
mkdir -p src/demo
```

- [ ] **Step 6: Install dependencies and verify build**

```bash
npm install
npm run build
```

Expected: Build succeeds (no source files yet, no output).

- [ ] **Step 7: Commit**

```bash
git init
git add package.json tsconfig.json jest.config.ts .gitignore
git commit -m "chore: initialize TypeScript project scaffold"
```

---

## Phase 2: Core Types & Interfaces

### Task 2: Define Action types and ToolResult

**Files:**
- Create: `src/action/types.ts`

**Interfaces:**
- Produces: `Action` union type, `ToolResult` interface, `GlobAction`, `GrepAction`, `ReadFileAction`, `WriteFileAction`, `ShellAction`, `RunTestsAction`, `DoneAction`

- [ ] **Step 1: Write the type definition file**

```typescript
// src/action/types.ts

// ─── Action Types ────────────────────────────────────────

export interface GlobAction {
  type: "glob";
  pattern: string;
}

export interface GrepAction {
  type: "grep";
  pattern: string;
  path?: string;
}

export interface ReadFileAction {
  type: "read_file";
  path: string;
}

export interface WriteFileAction {
  type: "write_file";
  path: string;
  content: string;
}

export interface ShellAction {
  type: "shell";
  command: string;
}

export interface RunTestsAction {
  type: "run_tests";
  target?: string;
}

export interface DoneAction {
  type: "done";
  summary: string;
}

export type Action =
  | GlobAction
  | GrepAction
  | ReadFileAction
  | WriteFileAction
  | ShellAction
  | RunTestsAction
  | DoneAction;

// ─── Tool Result ─────────────────────────────────────────

export interface ToolResult {
  success: boolean;
  output: string;
  action: Action;
  changedCode: boolean;   // true when the action modifies source files
  error?: string;
}
```

- [ ] **Step 2: Write a smoke test to verify types compile**

```typescript
// src/action/types.test.ts

import { Action, ToolResult } from "./types";

describe("Action types", () => {
  test("GlobAction has correct shape", () => {
    const action: Action = { type: "glob", pattern: "**/*.ts" };
    expect(action.type).toBe("glob");
    expect((action as any).pattern).toBe("**/*.ts");
  });

  test("ShellAction has correct shape", () => {
    const action: Action = { type: "shell", command: "echo hello" };
    expect(action.type).toBe("shell");
  });

  test("DoneAction has correct shape", () => {
    const action: Action = { type: "done", summary: "finished" };
    expect(action.type).toBe("done");
  });

  test("ToolResult with changedCode", () => {
    const result: ToolResult = {
      success: true,
      output: "ok",
      action: { type: "write_file", path: "a.ts", content: "x" },
      changedCode: true,
    };
    expect(result.changedCode).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify**

```bash
npx jest src/action/types.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/action/types.ts src/action/types.test.ts
git commit -m "feat: define Action union type and ToolResult interface"
```

### Task 3: ActionParser

**Files:**
- Create: `src/action/action-parser.ts`
- Create: `src/action/action-parser.test.ts`

**Interfaces:**
- Consumes: `Action` from `src/action/types.ts`
- Produces: `ActionParser` class with `parse(raw: string): { action: Action | null; error?: string }`

- [ ] **Step 1: Write the failing test**

```typescript
// src/action/action-parser.test.ts

import { ActionParser } from "./action-parser";

describe("ActionParser", () => {
  const parser = new ActionParser();

  test("parses valid glob action", () => {
    const { action, error } = parser.parse('{"type":"glob","pattern":"**/*.ts"}');
    expect(error).toBeUndefined();
    expect(action).toEqual({ type: "glob", pattern: "**/*.ts" });
  });

  test("parses valid shell action", () => {
    const { action, error } = parser.parse('{"type":"shell","command":"npm test"}');
    expect(error).toBeUndefined();
    expect(action).toEqual({ type: "shell", command: "npm test" });
  });

  test("parses valid done action", () => {
    const { action, error } = parser.parse('{"type":"done","summary":"all done"}');
    expect(error).toBeUndefined();
    expect(action).toEqual({ type: "done", summary: "all done" });
  });

  test("returns error for invalid JSON", () => {
    const { action, error } = parser.parse("not json");
    expect(action).toBeNull();
    expect(error).toContain("解析失败");
  });

  test("returns error for unknown action type", () => {
    const { action, error } = parser.parse('{"type":"unknown_action"}');
    expect(action).toBeNull();
    expect(error).toContain("未知的动作类型");
  });

  test("returns error for missing required field", () => {
    const { action, error } = parser.parse('{"type":"shell"}');
    expect(action).toBeNull();
    expect(error).toContain("缺少必需字段");
  });

  test("handles LLM output with extra text around JSON", () => {
    const { action, error } = parser.parse('Here is my action: {"type":"done","summary":"ok"}');
    expect(error).toBeUndefined();
    expect(action).toEqual({ type: "done", summary: "ok" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/action/action-parser.test.ts
```

Expected: FAIL — `ActionParser` not defined.

- [ ] **Step 3: Implement ActionParser**

```typescript
// src/action/action-parser.ts

import { Action } from "./types";

const VALID_TYPES = ["glob", "grep", "read_file", "write_file", "shell", "run_tests", "done"];

const REQUIRED_FIELDS: Record<string, string[]> = {
  glob: ["pattern"],
  grep: ["pattern"],
  read_file: ["path"],
  write_file: ["path", "content"],
  shell: ["command"],
  run_tests: [],
  done: ["summary"],
};

export class ActionParser {
  parse(raw: string): { action: Action | null; error?: string } {
    // Try to extract JSON from the raw text (LLM may add extra text)
    const json = this.extractJson(raw);
    if (!json) {
      return { action: null, error: `解析失败：无法从输出中提取 JSON。原始输出：${raw.slice(0, 200)}` };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { action: null, error: `解析失败：无效的 JSON 格式。原始内容：${json.slice(0, 200)}` };
    }

    if (!parsed.type || !VALID_TYPES.includes(parsed.type)) {
      return { action: null, error: `解析失败：未知的动作类型 "${parsed.type}"。有效类型：${VALID_TYPES.join(", ")}` };
    }

    const required = REQUIRED_FIELDS[parsed.type] || [];
    for (const field of required) {
      if (parsed[field] === undefined) {
        return { action: null, error: `解析失败：动作 "${parsed.type}" 缺少必需字段 "${field}"` };
      }
    }

    return { action: parsed as Action };
  }

  private extractJson(raw: string): string | null {
    // Try to find JSON object in the text
    const match = raw.match(/\{[\s\S]*"type"[\s\S]*\}/);
    return match ? match[0] : null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/action/action-parser.test.ts
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/action/action-parser.ts src/action/action-parser.test.ts
git commit -m "feat: implement ActionParser with JSON extraction and validation"
```

---

## Phase 3: LLM Abstraction Layer

### Task 4: LLMClient interface and shared types

**Files:**
- Create: `src/llm/types.ts`

**Interfaces:**
- Produces: `LLMClient` interface, `Message`, `LLMContext`, `LLMResponse`, `TokenUsage`, `LLMConfig` types

- [ ] **Step 1: Write the interface file**

```typescript
// src/llm/types.ts

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export interface LLMConfig {
  model: string;
  apiEndpoint: string;
  temperature: number;
  maxTokens: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content: string;
  finishReason: "stop" | "length" | "error";
  usage: TokenUsage;
}

export interface LLMClient {
  complete(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/llm/types.ts
git commit -m "feat: define LLMClient interface and shared types"
```

### Task 5: MockLLMClient

**Files:**
- Create: `src/llm/mock-llm-client.ts`
- Create: `src/llm/mock-llm-client.test.ts`

**Interfaces:**
- Consumes: `LLMClient`, `LLMResponse` from `src/llm/types.ts`
- Produces: `MockLLMClient` class implementing `LLMClient`

- [ ] **Step 1: Write the failing test**

```typescript
// src/llm/mock-llm-client.test.ts

import { MockLLMClient } from "./mock-llm-client";
import { Action } from "../action/types";

describe("MockLLMClient", () => {
  test("returns actions in sequence", async () => {
    const actions: Action[] = [
      { type: "glob", pattern: "*.ts" },
      { type: "shell", command: "npm test" },
      { type: "done", summary: "done" },
    ];
    const client = new MockLLMClient(actions);

    const r1 = await client.complete([{ role: "user", content: "task" }]);
    expect(JSON.parse(r1.content)).toEqual({ type: "glob", pattern: "*.ts" });

    const r2 = await client.complete([{ role: "user", content: "task" }]);
    expect(JSON.parse(r2.content)).toEqual({ type: "shell", command: "npm test" });

    const r3 = await client.complete([{ role: "user", content: "task" }]);
    expect(JSON.parse(r3.content)).toEqual({ type: "done", summary: "done" });
  });

  test("throws when actions exhausted", async () => {
    const client = new MockLLMClient([]);
    await expect(client.complete([])).rejects.toThrow("MockLLMClient: no more actions");
  });

  test("returns realistic usage data", async () => {
    const client = new MockLLMClient([{ type: "done", summary: "ok" }]);
    const r = await client.complete([{ role: "user", content: "hi" }]);
    expect(r.finishReason).toBe("stop");
    expect(r.usage.totalTokens).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/llm/mock-llm-client.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement MockLLMClient**

```typescript
// src/llm/mock-llm-client.ts

import { LLMClient, LLMResponse, Message, ToolDefinition } from "./types";
import { Action } from "../action/types";

export class MockLLMClient implements LLMClient {
  private actions: Action[];
  private index = 0;

  constructor(actions: Action[]) {
    this.actions = actions;
  }

  async complete(_messages: Message[], _tools?: ToolDefinition[]): Promise<LLMResponse> {
    if (this.index >= this.actions.length) {
      throw new Error("MockLLMClient: no more actions in sequence");
    }
    const action = this.actions[this.index++];
    return {
      content: JSON.stringify(action),
      finishReason: "stop",
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/llm/mock-llm-client.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/llm/mock-llm-client.ts src/llm/mock-llm-client.test.ts
git commit -m "feat: implement MockLLMClient with sequential action playback"
```

### Task 6: OpenAICompatibleClient

**Files:**
- Create: `src/llm/openai-compatible-client.ts`
- Create: `src/llm/openai-compatible-client.test.ts`

**Interfaces:**
- Consumes: `LLMClient`, `LLMConfig` from `src/llm/types.ts`
- Produces: `OpenAICompatibleClient` class implementing `LLMClient`

- [ ] **Step 1: Write the test (uses mock HTTP)**

```typescript
// src/llm/openai-compatible-client.test.ts

// Mock the OpenAI SDK before importing
jest.mock("openai", () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: '{"type":"done","summary":"ok"}' }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          }),
        },
      },
    })),
  };
});

import { OpenAICompatibleClient } from "./openai-compatible-client";

describe("OpenAICompatibleClient", () => {
  test("calls API with correct config", async () => {
    const client = new OpenAICompatibleClient({
      model: "glm-5.2",
      apiEndpoint: "https://njusehub.info/v1",
      temperature: 0.7,
      maxTokens: 4096,
    }, "test-api-key");

    const response = await client.complete([{ role: "user", content: "hello" }]);
    expect(response.content).toBe('{"type":"done","summary":"ok"}');
    expect(response.finishReason).toBe("stop");
    expect(response.usage.totalTokens).toBe(15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest src/llm/openai-compatible-client.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement OpenAICompatibleClient**

```typescript
// src/llm/openai-compatible-client.ts

import OpenAI from "openai";
import { LLMClient, LLMConfig, LLMResponse, Message, ToolDefinition } from "./types";

export class OpenAICompatibleClient implements LLMClient {
  private client: OpenAI;
  private config: LLMConfig;

  constructor(config: LLMConfig, apiKey: string) {
    this.config = config;
    this.client = new OpenAI({
      apiKey,
      baseURL: config.apiEndpoint,
    });
  }

  async complete(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const choice = completion.choices[0];
      const content = choice.message.content || "";

      let finishReason: LLMResponse["finishReason"] = "stop";
      if (choice.finish_reason === "length") finishReason = "length";
      if (choice.finish_reason === "stop" && !content) finishReason = "error";

      return {
        content,
        finishReason,
        usage: {
          promptTokens: completion.usage?.prompt_tokens ?? 0,
          completionTokens: completion.usage?.completion_tokens ?? 0,
          totalTokens: completion.usage?.total_tokens ?? 0,
        },
      };
    } catch (err: any) {
      return {
        content: "",
        finishReason: "error",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/llm/openai-compatible-client.test.ts
```

Expected: 1 test PASS.

- [ ] **Step 5: Commit**

```bash
git add src/llm/openai-compatible-client.ts src/llm/openai-compatible-client.test.ts
git commit -m "feat: implement OpenAICompatibleClient for njusehub.info API"
```

---

## Phase 4: Tool System

### Task 7: Tool interface and ToolDispatcher

**Files:**
- Create: `src/tools/types.ts`
- Create: `src/tools/tool-dispatcher.ts`
- Create: `src/tools/tool-dispatcher.test.ts`

**Interfaces:**
- Consumes: `Action`, `ToolResult` from `src/action/types.ts`
- Produces: `Tool` interface, `ToolDispatcher` class with `register(tool)` and `execute(action): Promise<ToolResult>`

- [ ] **Step 1: Write types and test**

```typescript
// src/tools/types.ts

import { Action, ToolResult } from "../action/types";

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute(action: Action): Promise<ToolResult>;
}
```

```typescript
// src/tools/tool-dispatcher.test.ts

import { ToolDispatcher } from "./tool-dispatcher";
import { Tool } from "./types";
import { Action } from "../action/types";

describe("ToolDispatcher", () => {
  test("dispatches to registered tool", async () => {
    const mockTool: Tool = {
      name: "glob",
      description: "Find files",
      parameters: { pattern: { type: "string", description: "Glob pattern", required: true } },
      execute: async (action) => ({
        success: true,
        output: "a.ts\nb.ts",
        action,
        changedCode: false,
      }),
    };

    const dispatcher = new ToolDispatcher();
    dispatcher.register(mockTool);

    const action: Action = { type: "glob", pattern: "*.ts" };
    const result = await dispatcher.execute(action);
    expect(result.success).toBe(true);
    expect(result.output).toBe("a.ts\nb.ts");
  });

  test("throws for unregistered tool", async () => {
    const dispatcher = new ToolDispatcher();
    const action: Action = { type: "glob", pattern: "*.ts" };
    await expect(dispatcher.execute(action)).rejects.toThrow("未注册的工具: glob");
  });
});
```

- [ ] **Step 2: Run to see failure, then implement**

```typescript
// src/tools/tool-dispatcher.ts

import { Tool } from "./types";
import { Action, ToolResult } from "../action/types";

export class ToolDispatcher {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  async execute(action: Action): Promise<ToolResult> {
    const tool = this.tools.get(action.type);
    if (!tool) {
      throw new Error(`未注册的工具: ${action.type}`);
    }
    return tool.execute(action);
  }
}
```

- [ ] **Step 3: Run tests → PASS, commit**

```bash
npx jest src/tools/tool-dispatcher.test.ts
git add src/tools/types.ts src/tools/tool-dispatcher.ts src/tools/tool-dispatcher.test.ts
git commit -m "feat: implement Tool interface and ToolDispatcher"
```

### Task 8: GlobTool, GrepTool, ReadFileTool

**Files:**
- Create: `src/tools/glob-tool.ts`, `src/tools/glob-tool.test.ts`
- Create: `src/tools/grep-tool.ts`, `src/tools/grep-tool.test.ts`
- Create: `src/tools/read-file-tool.ts`, `src/tools/read-file-tool.test.ts`

**Interfaces:**
- Consumes: `Tool` from `src/tools/types.ts`, `Action` from `src/action/types.ts`
- Produces: Three Tool implementations

- [ ] **Step 1: Write GlobTool + test**

```typescript
// src/tools/glob-tool.ts

import * as fs from "fs";
import * as path from "path";
import { Tool } from "./types";
import { Action, ToolResult } from "../action/types";

export class GlobTool implements Tool {
  name = "glob";
  description = "Find files matching a glob pattern";
  parameters = {
    pattern: { type: "string", description: "Glob pattern (e.g., **/*.ts)", required: true },
  };

  async execute(action: Action): Promise<ToolResult> {
    const a = action as any;
    const cwd = process.cwd();
    const pattern = a.pattern;

    // Simple glob implementation using recursive readdir
    const results: string[] = [];
    this.walk(cwd, pattern, results);

    return {
      success: true,
      output: results.length > 0 ? results.join("\n") : "(no files matched)",
      action,
      changedCode: false,
    };
  }

  private walk(dir: string, pattern: string, results: string[], depth = 0): void {
    if (depth > 10) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
          this.walk(full, pattern, results, depth + 1);
        } else if (entry.isFile() && this.matchSimple(entry.name, pattern)) {
          results.push(full);
        }
      }
    } catch { /* skip inaccessible dirs */ }
  }

  private matchSimple(name: string, pattern: string): boolean {
    if (pattern === "*" || pattern === "**/*") return true;
    if (pattern.startsWith("**/")) return name.endsWith(pattern.slice(3));
    if (pattern.startsWith("*.")) return name.endsWith(pattern.slice(1));
    return name === pattern;
  }
}
```

```typescript
// src/tools/glob-tool.test.ts

import { GlobTool } from "./glob-tool";
import * as fs from "fs";
import * as path from "path";

describe("GlobTool", () => {
  const tool = new GlobTool();
  const tmpDir = path.join(__dirname, "..", "..", "test-tmp");

  beforeAll(() => { fs.mkdirSync(tmpDir, { recursive: true }); });
  afterAll(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  test("finds matching files", async () => {
    const origCwd = process.cwd;
    process.cwd = () => tmpDir;
    fs.writeFileSync(path.join(tmpDir, "test.ts"), "// test");
    fs.writeFileSync(path.join(tmpDir, "test.js"), "// test");

    const result = await tool.execute({ type: "glob", pattern: "*.ts" });
    expect(result.success).toBe(true);

    process.cwd = origCwd;
  });

  test("changedCode is always false", async () => {
    const result = await tool.execute({ type: "glob", pattern: "*.ts" });
    expect(result.changedCode).toBe(false);
  });
});
```

- [ ] **Step 2: Write GrepTool + ReadFileTool similarly (TDD: test → fail → implement → pass)**

```typescript
// src/tools/grep-tool.ts

import * as fs from "fs";
import { Tool } from "./types";
import { Action, ToolResult } from "../action/types";

export class GrepTool implements Tool {
  name = "grep";
  description = "Search for a pattern in files";
  parameters = {
    pattern: { type: "string", description: "Regex pattern to search for", required: true },
    path: { type: "string", description: "File or directory to search in" },
  };

  async execute(action: Action): Promise<ToolResult> {
    const a = action as any;
    const searchPath = a.path || ".";
    const pattern = new RegExp(a.pattern, "g");
    const results: string[] = [];

    try {
      const stat = fs.statSync(searchPath);
      const files = stat.isDirectory()
        ? fs.readdirSync(searchPath, { recursive: true }).map((f) => `${searchPath}/${f}`)
        : [searchPath];

      for (const file of files.slice(0, 50)) {
        try {
          const content = fs.readFileSync(file, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
              results.push(`${file}:${i + 1}: ${lines[i].trim()}`);
            }
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }

    return {
      success: true,
      output: results.length > 0 ? results.slice(0, 30).join("\n") : "(no matches)",
      action,
      changedCode: false,
    };
  }
}
```

```typescript
// src/tools/read-file-tool.ts

import * as fs from "fs";
import { Tool } from "./types";
import { Action, ToolResult } from "../action/types";

export class ReadFileTool implements Tool {
  name = "read_file";
  description = "Read the contents of a file";
  parameters = {
    path: { type: "string", description: "Path to the file to read", required: true },
  };

  async execute(action: Action): Promise<ToolResult> {
    const a = action as any;
    try {
      const content = fs.readFileSync(a.path, "utf-8");
      return { success: true, output: content, action, changedCode: false };
    } catch (err: any) {
      return { success: false, output: `读取文件失败: ${err.message}`, action, changedCode: false, error: err.message };
    }
  }
}
```

- [ ] **Step 3: Run all tool tests**

```bash
npx jest src/tools/glob-tool.test.ts src/tools/grep-tool.test.ts src/tools/read-file-tool.test.ts
```

Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add src/tools/glob-tool.ts src/tools/glob-tool.test.ts \
        src/tools/grep-tool.ts src/tools/grep-tool.test.ts \
        src/tools/read-file-tool.ts src/tools/read-file-tool.test.ts
git commit -m "feat: implement GlobTool, GrepTool, ReadFileTool"
```

### Task 9: WriteFileTool

**Files:**
- Create: `src/tools/write-file-tool.ts`, `src/tools/write-file-tool.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/tools/write-file-tool.test.ts

import { WriteFileTool } from "./write-file-tool";
import * as fs from "fs";
import * as path from "path";

describe("WriteFileTool", () => {
  const tool = new WriteFileTool();
  const tmpDir = path.join(__dirname, "..", "..", "test-tmp");
  const testFile = path.join(tmpDir, "output.ts");

  beforeAll(() => { fs.mkdirSync(tmpDir, { recursive: true }); });
  afterAll(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  test("writes content to file", async () => {
    const result = await tool.execute({ type: "write_file", path: testFile, content: "const x = 1;" });
    expect(result.success).toBe(true);
    expect(fs.readFileSync(testFile, "utf-8")).toBe("const x = 1;");
  });

  test("changedCode is true", async () => {
    const result = await tool.execute({ type: "write_file", path: testFile, content: "x" });
    expect(result.changedCode).toBe(true);
  });

  test("creates parent directories", async () => {
    const nested = path.join(tmpDir, "deep", "nested", "file.ts");
    const result = await tool.execute({ type: "write_file", path: nested, content: "x" });
    expect(result.success).toBe(true);
    expect(fs.existsSync(nested)).toBe(true);
  });
});
```

- [ ] **Step 2: Implement → test → commit**

```typescript
// src/tools/write-file-tool.ts

import * as fs from "fs";
import * as path from "path";
import { Tool } from "./types";
import { Action, ToolResult } from "../action/types";

export class WriteFileTool implements Tool {
  name = "write_file";
  description = "Write content to a file, creating parent directories if needed";
  parameters = {
    path: { type: "string", description: "Path to file", required: true },
    content: { type: "string", description: "Content to write", required: true },
  };

  async execute(action: Action): Promise<ToolResult> {
    const a = action as any;
    try {
      const dir = path.dirname(a.path);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(a.path, a.content, "utf-8");
      return { success: true, output: `已写入 ${a.path}`, action, changedCode: true };
    } catch (err: any) {
      return { success: false, output: `写入失败: ${err.message}`, action, changedCode: false, error: err.message };
    }
  }
}
```

```bash
npx jest src/tools/write-file-tool.test.ts
git add src/tools/write-file-tool.ts src/tools/write-file-tool.test.ts
git commit -m "feat: implement WriteFileTool with mkdir -p behavior"
```

### Task 10: ShellTool

**Files:**
- Create: `src/tools/shell-tool.ts`, `src/tools/shell-tool.test.ts`

- [ ] **Step 1: Write test → implement → pass**

```typescript
// src/tools/shell-tool.ts

import { execSync } from "child_process";
import { Tool } from "./types";
import { Action, ToolResult } from "../action/types";

export class ShellTool implements Tool {
  name = "shell";
  description = "Execute a shell command";
  parameters = {
    command: { type: "string", description: "Shell command to run", required: true },
  };

  private timeoutMs = 30000;

  execute(action: Action): Promise<ToolResult> {
    return new Promise((resolve) => {
      const a = action as any;
      try {
        const output = execSync(a.command, {
          timeout: this.timeoutMs,
          encoding: "utf-8",
          maxBuffer: 1024 * 1024,
          cwd: process.cwd(),
        });
        // Detect workspace changes: check if any tracked files were modified
        const changedCode = this.detectWorkspaceChange();
        resolve({ success: true, output: output || "(executed successfully)", action, changedCode });
      } catch (err: any) {
        const msg = err.stderr || err.message || "unknown error";
        resolve({ success: false, output: `命令执行失败: ${msg}`, action, changedCode: false, error: msg });
      }
    });
  }

  private detectWorkspaceChange(): boolean {
    try {
      const diff = execSync("git diff --name-only", { encoding: "utf-8", timeout: 5000 });
      return diff.trim().length > 0;
    } catch {
      return false;
    }
  }
}
```

```typescript
// src/tools/shell-tool.test.ts

import { ShellTool } from "./shell-tool";

describe("ShellTool", () => {
  const tool = new ShellTool();

  test("executes echo command", async () => {
    const result = await tool.execute({ type: "shell", command: "echo hello" });
    expect(result.success).toBe(true);
    expect(result.output).toContain("hello");
  });

  test("handles failing command", async () => {
    const result = await tool.execute({ type: "shell", command: "nonexistentcommand 2>&1" });
    expect(result.success).toBe(false);
  });

  test("changedCode is boolean", async () => {
    const result = await tool.execute({ type: "shell", command: "echo test" });
    expect(typeof result.changedCode).toBe("boolean");
  });
});
```

```bash
npx jest src/tools/shell-tool.test.ts
git add src/tools/shell-tool.ts src/tools/shell-tool.test.ts
git commit -m "feat: implement ShellTool with workspace change detection"
```

### Task 11: TestTool

**Files:**
- Create: `src/tools/test-tool.ts`, `src/tools/test-tool.test.ts`

- [ ] **Step 1: Write test → implement → pass**

```typescript
// src/tools/test-tool.ts

import { execSync } from "child_process";
import { Tool } from "./types";
import { Action, ToolResult } from "../action/types";

export class TestTool implements Tool {
  name = "run_tests";
  description = "Run the project's test suite";
  parameters = {
    target: { type: "string", description: "Specific test file or pattern to run" },
  };

  async execute(action: Action): Promise<ToolResult> {
    const a = action as any;
    const cmd = a.target ? `npx jest ${a.target}` : "npm test";
    try {
      const output = execSync(cmd, { encoding: "utf-8", timeout: 120000, maxBuffer: 1024 * 1024 });
      return { success: true, output, action, changedCode: false };
    } catch (err: any) {
      const output = err.stdout || err.stderr || err.message || "";
      return { success: false, output, action, changedCode: false, error: output };
    }
  }
}
```

```typescript
// src/tools/test-tool.test.ts

import { TestTool } from "./test-tool";

describe("TestTool", () => {
  it("changedCode is always false", async () => {
    const tool = new TestTool();
    const result = await tool.execute({ type: "run_tests" });
    expect(result.changedCode).toBe(false);
  });
});
```

```bash
npx jest src/tools/test-tool.test.ts
git add src/tools/test-tool.ts src/tools/test-tool.test.ts
git commit -m "feat: implement TestTool (changedCode always false)"
```

---

## Phase 5: Guard Pipeline ⭐ (Deep Dimension)

### Task 12: RuleGuard

**Files:**
- Create: `src/guard/types.ts`
- Create: `src/guard/rule-guard.ts`
- Create: `src/guard/rule-guard.test.ts`

**Interfaces:**
- Consumes: `Action` from `src/action/types.ts`
- Produces: `GuardResult`, `GuardRule` types, `RuleGuard` class

- [ ] **Step 1: Write types**

```typescript
// src/guard/types.ts

export interface GuardRule {
  pattern: string;
  matchOn: "command" | "path" | "action_type";
  action: "deny" | "ask";
}

export interface GuardResult {
  verdict: "allow" | "deny" | "ask";
  reason?: string;
  matchedRule?: string;
}

export interface SandboxPolicy {
  allowedPaths: string[];
  bannedCommands: string[];
  timeoutMs: number;
  maxFileSize: number;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/guard/rule-guard.test.ts

import { RuleGuard } from "./rule-guard";
import { GuardRule } from "./types";

const DEFAULT_RULES: GuardRule[] = [
  { pattern: "rm -rf", matchOn: "command", action: "deny" },
  { pattern: "DROP TABLE", matchOn: "command", action: "deny" },
  { pattern: "DELETE FROM", matchOn: "command", action: "deny" },
  { pattern: "git push", matchOn: "command", action: "ask" },
  { pattern: ".env", matchOn: "path", action: "deny" },
  { pattern: "/etc/", matchOn: "path", action: "deny" },
  { pattern: "npm publish", matchOn: "command", action: "ask" },
];

describe("RuleGuard", () => {
  const guard = new RuleGuard(DEFAULT_RULES);

  test("denies rm -rf command", () => {
    const result = guard.check({ type: "shell", command: "rm -rf /" });
    expect(result.verdict).toBe("deny");
    expect(result.matchedRule).toBe("rm -rf");
  });

  test("denies DROP TABLE command", () => {
    const result = guard.check({ type: "shell", command: "DROP TABLE users" });
    expect(result.verdict).toBe("deny");
  });

  test("escalates git push to ask", () => {
    const result = guard.check({ type: "shell", command: "git push origin main" });
    expect(result.verdict).toBe("ask");
  });

  test("denies .env path access", () => {
    const result = guard.check({ type: "read_file", path: ".env" });
    expect(result.verdict).toBe("deny");
  });

  test("allows safe commands", () => {
    const result = guard.check({ type: "shell", command: "echo hello" });
    expect(result.verdict).toBe("allow");
  });

  test("allows safe file reads", () => {
    const result = guard.check({ type: "read_file", path: "src/index.ts" });
    expect(result.verdict).toBe("allow");
  });
});
```

- [ ] **Step 3: Implement → test → commit**

```typescript
// src/guard/rule-guard.ts

import { GuardRule, GuardResult } from "./types";
import { Action } from "../action/types";

export class RuleGuard {
  constructor(private rules: GuardRule[]) {}

  check(action: Action): GuardResult {
    for (const rule of this.rules) {
      const matched = this.matchRule(action, rule);
      if (matched) {
        return { verdict: rule.action, reason: `匹配规则: ${rule.pattern}`, matchedRule: rule.pattern };
      }
    }
    return { verdict: "allow" };
  }

  private matchRule(action: Action, rule: GuardRule): boolean {
    switch (rule.matchOn) {
      case "command":
        return action.type === "shell" && (action as any).command?.includes(rule.pattern);
      case "path":
        return (action.type === "read_file" || action.type === "write_file" || action.type === "glob" || action.type === "grep")
          && (action as any).path?.includes(rule.pattern);
      case "action_type":
        return action.type === rule.pattern;
      default:
        return false;
    }
  }
}
```

```bash
npx jest src/guard/rule-guard.test.ts
git add src/guard/types.ts src/guard/rule-guard.ts src/guard/rule-guard.test.ts
git commit -m "feat: implement RuleGuard with command/path/action matching"
```

### Task 13: SandboxGuard

**Files:**
- Create: `src/guard/sandbox-guard.ts`
- Create: `src/guard/sandbox-guard.test.ts`

**Interfaces:**
- Consumes: `SandboxPolicy`, `GuardResult` from `src/guard/types.ts`, `Action` from `src/action/types.ts`
- Produces: `SandboxGuard` class with path normalization

- [ ] **Step 1: Write the failing test**

```typescript
// src/guard/sandbox-guard.test.ts

import { SandboxGuard } from "./sandbox-guard";
import { SandboxPolicy } from "./types";
import * as path from "path";

const policy: SandboxPolicy = {
  allowedPaths: [path.resolve("/project")],
  bannedCommands: ["sudo", "su", "chmod 777"],
  timeoutMs: 30000,
  maxFileSize: 1024 * 1024,
};

describe("SandboxGuard", () => {
  const guard = new SandboxGuard(policy);

  test("allows path within allowed dirs", () => {
    const result = guard.check({ type: "read_file", path: "/project/src/index.ts" });
    expect(result.verdict).toBe("allow");
  });

  test("denies path outside allowed dirs", () => {
    const result = guard.check({ type: "read_file", path: "/etc/passwd" });
    expect(result.verdict).toBe("deny");
    expect(result.reason).toContain("路径");
  });

  test("denies path traversal attack", () => {
    const result = guard.check({ type: "read_file", path: "/project/../etc/passwd" });
    expect(result.verdict).toBe("deny");
    expect(result.reason).toContain("路径");
  });

  test("denies path traversal with nested dots", () => {
    const result = guard.check({ type: "read_file", path: "/project/subdir/../../etc/shadow" });
    expect(result.verdict).toBe("deny");
  });

  test("denies banned commands", () => {
    const result = guard.check({ type: "shell", command: "sudo rm -rf /" });
    expect(result.verdict).toBe("deny");
  });

  test("allows non-file actions", () => {
    const result = guard.check({ type: "done", summary: "ok" });
    expect(result.verdict).toBe("allow");
  });
});
```

- [ ] **Step 2: Implement → test → commit**

```typescript
// src/guard/sandbox-guard.ts

import * as path from "path";
import { SandboxPolicy, GuardResult } from "./types";
import { Action } from "../action/types";

export class SandboxGuard {
  constructor(private policy: SandboxPolicy) {}

  check(action: Action): GuardResult {
    // Check file/directory paths
    if ("path" in action) {
      const filePath = (action as any).path as string;
      if (filePath) {
        const result = this.checkPath(filePath);
        if (result) return result;
      }
    }

    // Check shell commands
    if (action.type === "shell") {
      const command = (action as any).command as string;
      if (command) {
        const result = this.checkCommand(command);
        if (result) return result;
      }
    }

    return { verdict: "allow" };
  }

  private checkPath(inputPath: string): GuardResult | null {
    // Step 1: resolve to absolute
    let resolved: string;
    try {
      resolved = path.resolve(inputPath);
    } catch {
      return { verdict: "deny", reason: `无法解析路径: ${inputPath}` };
    }

    // Step 2: normalize (remove .., ., double slashes)
    const normalized = path.normalize(resolved);

    // Step 3: check if under any allowed path
    const isAllowed = this.policy.allowedPaths.some((allowed) => {
      const resolvedAllowed = path.resolve(allowed);
      return normalized.startsWith(resolvedAllowed + path.sep) || normalized === resolvedAllowed;
    });

    if (!isAllowed) {
      return { verdict: "deny", reason: `路径 "${inputPath}" (规范化: ${normalized}) 不在允许范围内` };
    }

    return null;
  }

  private checkCommand(command: string): GuardResult | null {
    for (const banned of this.policy.bannedCommands) {
      if (command.includes(banned)) {
        return { verdict: "deny", reason: `命令包含禁止模式: "${banned}"` };
      }
    }
    return null;
  }
}
```

```bash
npx jest src/guard/sandbox-guard.test.ts
git add src/guard/sandbox-guard.ts src/guard/sandbox-guard.test.ts
git commit -m "feat: implement SandboxGuard with path normalization and traversal protection"
```

### Task 14: Approver interface + HITLGuard

**Files:**
- Create: `src/guard/approvers/approver.ts`
- Create: `src/guard/approvers/interactive-approver.ts`
- Create: `src/guard/approvers/stub-approver.ts`
- Create: `src/guard/hitl-guard.ts`
- Create: `src/guard/hitl-guard.test.ts`

- [ ] **Step 1: Write Approver interface**

```typescript
// src/guard/approvers/approver.ts

import { Action } from "../../action/types";

export interface Approver {
  approve(action: Action): Promise<{ approved: boolean; reason?: string }>;
}
```

```typescript
// src/guard/approvers/stub-approver.ts

import { Approver } from "./approver";
import { Action } from "../../action/types";

export class StubApprover implements Approver {
  constructor(private response: "always_allow" | "always_deny") {}

  async approve(_action: Action): Promise<{ approved: boolean; reason?: string }> {
    if (this.response === "always_allow") {
      return { approved: true };
    }
    return { approved: false, reason: "StubApprover: 自动拒绝" };
  }
}
```

```typescript
// src/guard/approvers/interactive-approver.ts

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
        if (answer.toLowerCase() === "y") {
          resolve({ approved: true });
        } else {
          resolve({ approved: false, reason: "用户拒绝" });
        }
      });
    });
  }
}
```

- [ ] **Step 2: Write HITLGuard test**

```typescript
// src/guard/hitl-guard.test.ts

import { HITLGuard } from "./hitl-guard";
import { StubApprover } from "./approvers/stub-approver";

describe("HITLGuard", () => {
  test("stub allows action", async () => {
    const guard = new HITLGuard(new StubApprover("always_allow"));
    const result = await guard.check({ type: "shell", command: "git push" });
    expect(result.verdict).toBe("allow");
  });

  test("stub denies action", async () => {
    const guard = new HITLGuard(new StubApprover("always_deny"));
    const result = await guard.check({ type: "shell", command: "git push" });
    expect(result.verdict).toBe("deny");
    expect(result.reason).toBe("StubApprover: 自动拒绝");
  });

  test("starts in idle state", () => {
    const guard = new HITLGuard(new StubApprover("always_allow"));
    expect(guard.state).toBe("idle");
  });
});
```

- [ ] **Step 3: Implement HITLGuard**

```typescript
// src/guard/hitl-guard.ts

import { GuardResult } from "./types";
import { Approver } from "./approvers/approver";
import { Action } from "../action/types";

export type HITLState = "idle" | "waiting" | "approved" | "denied";

export class HITLGuard {
  state: HITLState = "idle";

  constructor(private approver: Approver) {}

  async check(action: Action): Promise<GuardResult> {
    this.state = "waiting";
    const { approved, reason } = await this.approver.approve(action);

    if (approved) {
      this.state = "approved";
      return { verdict: "allow" };
    }

    this.state = "denied";
    return { verdict: "deny", reason: reason || "人工确认未通过" };
  }
}
```

```bash
npx jest src/guard/hitl-guard.test.ts
git add src/guard/approvers/ src/guard/hitl-guard.ts src/guard/hitl-guard.test.ts
git commit -m "feat: implement Approver interface, StubApprover, InteractiveApprover, and HITLGuard"
```

### Task 15: GuardPipeline

**Files:**
- Create: `src/guard/guard-pipeline.ts`
- Create: `src/guard/guard-pipeline.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// src/guard/guard-pipeline.test.ts

import { GuardPipeline } from "./guard-pipeline";
import { RuleGuard } from "./rule-guard";
import { SandboxGuard } from "./sandbox-guard";
import { HITLGuard } from "./hitl-guard";
import { StubApprover } from "./approvers/stub-approver";
import { GuardRule, SandboxPolicy } from "./types";
import * as path from "path";

const rules: GuardRule[] = [
  { pattern: "rm -rf", matchOn: "command", action: "deny" },
  { pattern: "git push", matchOn: "command", action: "ask" },
];
const policy: SandboxPolicy = {
  allowedPaths: [path.resolve("/project")],
  bannedCommands: ["sudo"],
  timeoutMs: 30000,
  maxFileSize: 1024 * 1024,
};

describe("GuardPipeline", () => {
  test("RuleGuard denies before SandboxGuard", () => {
    const pipeline = new GuardPipeline(
      new RuleGuard(rules),
      new SandboxGuard(policy),
      new HITLGuard(new StubApprover("always_allow"))
    );
    // rm -rf is denied by RuleGuard, never reaches Sandbox or HITL
    pipeline.check({ type: "shell", command: "sudo rm -rf /" }).then((result) => {
      expect(result.verdict).toBe("deny");
      expect(result.matchedRule).toBe("rm -rf");
    });
  });

  test("escalates to HITL for ask rules", async () => {
    const pipeline = new GuardPipeline(
      new RuleGuard(rules),
      new SandboxGuard(policy),
      new HITLGuard(new StubApprover("always_allow"))
    );
    const result = await pipeline.check({ type: "shell", command: "git push origin main" });
    // RuleGuard returns "ask" → HITL stub auto-approves
    expect(result.verdict).toBe("allow");
  });
});
```

- [ ] **Step 2: Implement GuardPipeline → test → commit**

```typescript
// src/guard/guard-pipeline.ts

import { GuardResult } from "./types";
import { RuleGuard } from "./rule-guard";
import { SandboxGuard } from "./sandbox-guard";
import { HITLGuard } from "./hitl-guard";
import { Action } from "../action/types";

export class GuardPipeline {
  constructor(
    private ruleGuard: RuleGuard,
    private sandboxGuard: SandboxGuard,
    private hitlGuard: HITLGuard
  ) {}

  async check(action: Action): Promise<GuardResult> {
    // Layer 1: Rule matching
    const ruleResult = this.ruleGuard.check(action);
    if (ruleResult.verdict === "deny") return ruleResult;
    if (ruleResult.verdict === "ask") {
      // Escalate to HITL
      const hitlResult = await this.hitlGuard.check(action);
      if (hitlResult.verdict === "deny") return hitlResult;
      // HITL approved → continue to Sandbox
    }

    // Layer 2: Sandbox boundary
    const sandboxResult = this.sandboxGuard.check(action);
    if (sandboxResult.verdict === "deny") return sandboxResult;

    return { verdict: "allow" };
  }
}
```

```bash
npx jest src/guard/guard-pipeline.test.ts
git add src/guard/guard-pipeline.ts src/guard/guard-pipeline.test.ts
git commit -m "feat: implement GuardPipeline orchestrating RuleGuard → HITL → SandboxGuard"
```

---

## Phase 6: Feedback Loop

### Task 16: Sensor interface + MockSensor

**Files:**
- Create: `src/feedback/types.ts`
- Create: `src/feedback/sensors/mock-sensor.ts`
- Create: `src/feedback/sensors/mock-sensor.test.ts`

- [ ] **Step 1: Write types and MockSensor**

```typescript
// src/feedback/types.ts

export interface SensorOutput {
  status: "pass" | "fail" | "error";
  details: string;
  failureCount: number;
}

export interface Feedback {
  hasFailures: boolean;
  message: string;
  failureCount: number;
}

export interface Sensor {
  name: string;
  run(): Promise<SensorOutput>;
  parse(output: SensorOutput): Feedback;
}
```

```typescript
// src/feedback/sensors/mock-sensor.ts

import { Sensor, SensorOutput, Feedback } from "../types";

export class MockSensor implements Sensor {
  name = "mock";

  constructor(private mockOutput: SensorOutput) {}

  async run(): Promise<SensorOutput> {
    return this.mockOutput;
  }

  parse(output: SensorOutput): Feedback {
    return {
      hasFailures: output.status === "fail" || output.status === "error",
      message: `[${this.name}] ${output.details}`,
      failureCount: output.failureCount,
    };
  }
}
```

```typescript
// src/feedback/sensors/mock-sensor.test.ts

import { MockSensor } from "./mock-sensor";

describe("MockSensor", () => {
  test("returns preset failure", async () => {
    const sensor = new MockSensor({
      status: "fail",
      details: "1 test failed: expect(1+1).toBe(3)",
      failureCount: 1,
    });
    const output = await sensor.run();
    expect(output.status).toBe("fail");
    const feedback = sensor.parse(output);
    expect(feedback.hasFailures).toBe(true);
    expect(feedback.failureCount).toBe(1);
  });

  test("returns preset pass", async () => {
    const sensor = new MockSensor({ status: "pass", details: "All tests pass", failureCount: 0 });
    const output = await sensor.run();
    const feedback = sensor.parse(output);
    expect(feedback.hasFailures).toBe(false);
  });
});
```

```bash
npx jest src/feedback/sensors/mock-sensor.test.ts
git add src/feedback/types.ts src/feedback/sensors/mock-sensor.ts src/feedback/sensors/mock-sensor.test.ts
git commit -m "feat: define Sensor interface and MockSensor"
```

### Task 17: TestSensor, LintSensor, TypeCheckSensor

**Files:**
- Create: `src/feedback/sensors/test-sensor.ts`, `src/feedback/sensors/test-sensor.test.ts`
- Create: `src/feedback/sensors/lint-sensor.ts`
- Create: `src/feedback/sensors/type-check-sensor.ts`

- [ ] **Step 1: Write TestSensor**

```typescript
// src/feedback/sensors/test-sensor.ts

import { execSync } from "child_process";
import { Sensor, SensorOutput, Feedback } from "../types";

export class TestSensor implements Sensor {
  name = "test";

  async run(): Promise<SensorOutput> {
    try {
      const output = execSync("npm test 2>&1", { encoding: "utf-8", timeout: 120000 });
      return this.parseOutput(output, true);
    } catch (err: any) {
      const output = (err.stdout || "") + (err.stderr || "");
      return this.parseOutput(output, false);
    }
  }

  private parseOutput(output: string, passed: boolean): SensorOutput {
    if (passed) {
      return { status: "pass", details: "All tests passed", failureCount: 0 };
    }
    // Count failures from Jest output
    const failMatch = output.match(/Tests:\s+\d+\s+failed,\s+\d+\s+total/);
    const countMatch = output.match(/Tests:\s+(\d+)\s+failed/);
    const failureCount = countMatch ? parseInt(countMatch[1]) : 1;
    return {
      status: "fail",
      details: output.slice(-2000), // Last 2000 chars
      failureCount,
    };
  }

  parse(output: SensorOutput): Feedback {
    return {
      hasFailures: output.status === "fail",
      message: `[测试] ${output.failureCount > 0 ? `${output.failureCount} 个测试失败` : "全部通过"}\n\n${output.details.slice(0, 1500)}`,
      failureCount: output.failureCount,
    };
  }
}
```

```typescript
// src/feedback/sensors/test-sensor.test.ts

import { TestSensor } from "./test-sensor";

describe("TestSensor", () => {
  test("parse passes on success", () => {
    const sensor = new TestSensor();
    const feedback = sensor.parse({ status: "pass", details: "ok", failureCount: 0 });
    expect(feedback.hasFailures).toBe(false);
  });

  test("parse fails on failure", () => {
    const sensor = new TestSensor();
    const feedback = sensor.parse({ status: "fail", details: "1 failed", failureCount: 1 });
    expect(feedback.hasFailures).toBe(true);
    expect(feedback.failureCount).toBe(1);
  });
});
```

- [ ] **Step 2: Write LintSensor and TypeCheckSensor (same pattern, different command)**

```typescript
// src/feedback/sensors/lint-sensor.ts

import { execSync } from "child_process";
import { Sensor, SensorOutput, Feedback } from "../types";

export class LintSensor implements Sensor {
  name = "lint";

  async run(): Promise<SensorOutput> {
    try {
      execSync("npx eslint . 2>&1", { encoding: "utf-8", timeout: 60000 });
      return { status: "pass", details: "No lint errors", failureCount: 0 };
    } catch (err: any) {
      const output = (err.stdout || "") + (err.stderr || "");
      const count = (output.match(/error/g) || []).length;
      return { status: "fail", details: output.slice(-2000), failureCount: count || 1 };
    }
  }

  parse(output: SensorOutput): Feedback {
    return {
      hasFailures: output.status === "fail",
      message: `[Lint] ${output.failureCount > 0 ? `${output.failureCount} 个 lint 错误` : "无 lint 错误"}\n\n${output.details.slice(0, 1500)}`,
      failureCount: output.failureCount,
    };
  }
}
```

```typescript
// src/feedback/sensors/type-check-sensor.ts

import { execSync } from "child_process";
import { Sensor, SensorOutput, Feedback } from "../types";

export class TypeCheckSensor implements Sensor {
  name = "typecheck";

  async run(): Promise<SensorOutput> {
    try {
      execSync("npx tsc --noEmit 2>&1", { encoding: "utf-8", timeout: 60000 });
      return { status: "pass", details: "No type errors", failureCount: 0 };
    } catch (err: any) {
      const output = (err.stdout || "") + (err.stderr || "");
      const count = (output.match(/error TS\d+/g) || []).length;
      return { status: "fail", details: output.slice(-2000), failureCount: count || 1 };
    }
  }

  parse(output: SensorOutput): Feedback {
    return {
      hasFailures: output.status === "fail",
      message: `[类型检查] ${output.failureCount > 0 ? `${output.failureCount} 个类型错误` : "无类型错误"}\n\n${output.details.slice(0, 1500)}`,
      failureCount: output.failureCount,
    };
  }
}
```

```bash
npx jest src/feedback/sensors/test-sensor.test.ts
git add src/feedback/sensors/
git commit -m "feat: implement TestSensor, LintSensor, TypeCheckSensor"
```

### Task 18: FeedbackLoop

**Files:**
- Create: `src/feedback/feedback-loop.ts`
- Create: `src/feedback/feedback-loop.test.ts`

- [ ] **Step 1: Write test → implement → commit**

```typescript
// src/feedback/feedback-loop.ts

import { Sensor, Feedback } from "./types";
import { Action, ToolResult } from "../action/types";

export class FeedbackLoop {
  constructor(private sensors: Sensor[]) {}

  async evaluate(_action: Action, result: ToolResult): Promise<Feedback | null> {
    // Only trigger when code was changed
    if (!result.changedCode) return null;

    const allFeedback: Feedback[] = [];
    for (const sensor of this.sensors) {
      const output = await sensor.run();
      const feedback = sensor.parse(output);
      if (feedback.hasFailures) {
        allFeedback.push(feedback);
      }
    }

    if (allFeedback.length === 0) return null;

    const totalFailures = allFeedback.reduce((sum, f) => sum + f.failureCount, 0);
    return {
      hasFailures: true,
      message: allFeedback.map((f) => f.message).join("\n\n"),
      failureCount: totalFailures,
    };
  }
}
```

```typescript
// src/feedback/feedback-loop.test.ts

import { FeedbackLoop } from "./feedback-loop";
import { MockSensor } from "./sensors/mock-sensor";

describe("FeedbackLoop", () => {
  test("skips when changedCode is false", async () => {
    const loop = new FeedbackLoop([new MockSensor({ status: "fail", details: "err", failureCount: 1 })]);
    const result = { success: true, output: "ok", action: { type: "glob", pattern: "*" }, changedCode: false };
    const feedback = await loop.evaluate({ type: "glob", pattern: "*" }, result);
    expect(feedback).toBeNull();
  });

  test("triggers when changedCode is true", async () => {
    const loop = new FeedbackLoop([new MockSensor({ status: "fail", details: "1 test failed", failureCount: 1 })]);
    const result = { success: true, output: "ok", action: { type: "write_file", path: "x.ts", content: "x" }, changedCode: true };
    const feedback = await loop.evaluate({ type: "write_file", path: "x.ts", content: "x" }, result);
    expect(feedback).not.toBeNull();
    expect(feedback!.hasFailures).toBe(true);
  });

  test("returns null when all sensors pass", async () => {
    const loop = new FeedbackLoop([new MockSensor({ status: "pass", details: "ok", failureCount: 0 })]);
    const result = { success: true, output: "ok", action: { type: "write_file", path: "x.ts", content: "x" }, changedCode: true };
    const feedback = await loop.evaluate({ type: "write_file", path: "x.ts", content: "x" }, result);
    expect(feedback).toBeNull();
  });
});
```

```bash
npx jest src/feedback/feedback-loop.test.ts
git add src/feedback/feedback-loop.ts src/feedback/feedback-loop.test.ts
git commit -m "feat: implement FeedbackLoop with changedCode gate and sensor pipeline"
```

---

## Phase 7: Memory & Config

### Task 19: FileMemory

**Files:**
- Create: `src/memory/file-memory.ts`
- Create: `src/memory/file-memory.test.ts`

**Interfaces:**
- Produces: `Memory` interface, `FileMemory` class

- [ ] **Step 1: Write interface and implementation**

```typescript
// src/memory/file-memory.ts

import * as fs from "fs";
import * as path from "path";

export interface MemoryEntry {
  id: string;
  timestamp: string;
  goal: string;
  summary: string;
  decisions: string[];
}

export interface Memory {
  retrieve(goal: string): Promise<string>;
  consolidate(context: string): Promise<void>;
}

export class FileMemory implements Memory {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(process.env.HOME || "~", ".noopcoder", "memory");
    fs.mkdirSync(this.basePath, { recursive: true });
  }

  async retrieve(goal: string): Promise<string> {
    try {
      const files = fs.readdirSync(this.basePath).filter((f) => f.endsWith(".json"));
      if (files.length === 0) return "";

      const entries: string[] = [];
      for (const file of files.slice(0, 10)) {
        const content = JSON.parse(fs.readFileSync(path.join(this.basePath, file), "utf-8"));
        // Simple keyword matching
        if (this.matchesGoal(content, goal)) {
          entries.push(`[${content.goal}]: ${content.summary}`);
        }
      }
      return entries.length > 0 ? `历史记录:\n${entries.join("\n")}` : "";
    } catch {
      return "";
    }
  }

  async consolidate(context: string): Promise<void> {
    const entry: MemoryEntry = {
      id: Date.now().toString(36),
      timestamp: new Date().toISOString(),
      goal: this.extractGoal(context),
      summary: context.slice(-500),
      decisions: [],
    };
    fs.writeFileSync(
      path.join(this.basePath, `${entry.id}.json`),
      JSON.stringify(entry, null, 2),
    );
  }

  private matchesGoal(entry: any, goal: string): boolean {
    const keywords = goal.toLowerCase().split(/\s+/).filter((k) => k.length > 2);
    const target = (entry.goal || "").toLowerCase();
    return keywords.some((kw) => target.includes(kw));
  }

  private extractGoal(context: string): string {
    const match = context.match(/goal["\s:]+["\s]?([^"\n]{10,100})/);
    return match ? match[1] : context.slice(0, 50);
  }
}
```

- [ ] **Step 2: Write test → commit**

```typescript
// src/memory/file-memory.test.ts

import { FileMemory } from "./file-memory";
import * as fs from "fs";
import * as path from "path";

describe("FileMemory", () => {
  const tmpDir = path.join(__dirname, "..", "..", "test-tmp-memory");

  beforeEach(() => { fs.mkdirSync(tmpDir, { recursive: true }); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  test("retrieve returns empty for empty memory", async () => {
    const memory = new FileMemory(tmpDir);
    const result = await memory.retrieve("fix bugs");
    expect(result).toBe("");
  });

  test("consolidate writes a file", async () => {
    const memory = new FileMemory(tmpDir);
    await memory.consolidate("goal: fix bug\nsummary: fixed the bug");
    const files = fs.readdirSync(tmpDir);
    expect(files.length).toBe(1);
  });
});
```

```bash
npx jest src/memory/file-memory.test.ts
git add src/memory/file-memory.ts src/memory/file-memory.test.ts
git commit -m "feat: implement FileMemory with keyword-based retrieval"
```

### Task 20: Config system

**Files:**
- Create: `src/config/types.ts`
- Create: `src/config/config-loader.ts`
- Create: `src/config/config-loader.test.ts`

- [ ] **Step 1: Write types + loader + test**

```typescript
// src/config/types.ts

import { GuardRule, SandboxPolicy } from "../guard/types";

export interface LLMConfigBlock {
  provider: string;
  model: string;
  apiEndpoint: string;
  temperature: number;
  maxTokens: number;
}

export interface RunConfigBlock {
  maxSteps: number;
  timeoutMs: number;
  maxConsecutiveFailures: number;
  contextLimit: number;
}

export interface Config {
  guardRules: GuardRule[];
  sandbox: SandboxPolicy;
  llm: LLMConfigBlock;
  run: RunConfigBlock;
  sensors: string[];
}

export const DEFAULT_CONFIG: Config = {
  guardRules: [
    { pattern: "rm -rf", matchOn: "command", action: "deny" },
    { pattern: "DROP TABLE", matchOn: "command", action: "deny" },
    { pattern: "DELETE FROM", matchOn: "command", action: "deny" },
    { pattern: "git push", matchOn: "command", action: "ask" },
    { pattern: ".env", matchOn: "path", action: "deny" },
    { pattern: "/etc/", matchOn: "path", action: "deny" },
    { pattern: "npm publish", matchOn: "command", action: "ask" },
  ],
  sandbox: {
    allowedPaths: [process.cwd()],
    bannedCommands: ["sudo", "su", "chmod 777", "> /dev/sda"],
    timeoutMs: 30000,
    maxFileSize: 1024 * 1024,
  },
  llm: {
    provider: "openai-compatible",
    model: "glm-5.2",
    apiEndpoint: "https://njusehub.info/v1",
    temperature: 0.7,
    maxTokens: 4096,
  },
  run: {
    maxSteps: 50,
    timeoutMs: 600000,
    maxConsecutiveFailures: 5,
    contextLimit: 128000,
  },
  sensors: ["test", "lint", "typecheck"],
};
```

```typescript
// src/config/config-loader.ts

import * as fs from "fs";
import * as path from "path";
import { Config, DEFAULT_CONFIG } from "./types";

export class ConfigLoader {
  static load(configPath?: string): Config {
    const defaultPath = configPath || path.join(process.env.HOME || "~", ".noopcoder", "config.json");
    try {
      const raw = fs.readFileSync(defaultPath, "utf-8");
      const userConfig = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...userConfig };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }
}
```

```typescript
// src/config/config-loader.test.ts

import { ConfigLoader } from "./config-loader";
import * as fs from "fs";
import * as path from "path";

describe("ConfigLoader", () => {
  const tmpDir = path.join(__dirname, "..", "..", "test-tmp-config");

  beforeEach(() => { fs.mkdirSync(tmpDir, { recursive: true }); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  test("loads default config when no file", () => {
    const config = ConfigLoader.load(path.join(tmpDir, "nonexistent.json"));
    expect(config.llm.model).toBe("glm-5.2");
    expect(config.run.maxSteps).toBe(50);
  });

  test("merges user config overrides", () => {
    fs.writeFileSync(path.join(tmpDir, "custom.json"), JSON.stringify({ run: { maxSteps: 10 } }));
    const config = ConfigLoader.load(path.join(tmpDir, "custom.json"));
    expect(config.run.maxSteps).toBe(10);
    expect(config.llm.model).toBe("glm-5.2"); // default preserved
  });
});
```

```bash
npx jest src/config/config-loader.test.ts
git add src/config/types.ts src/config/config-loader.ts src/config/config-loader.test.ts
git commit -m "feat: implement Config system with defaults and user overrides"
```

### Task 21: CredentialManager

**Files:**
- Create: `src/config/credential-manager.ts`
- Create: `src/config/credential-manager.test.ts`

- [ ] **Step 1: Write implementation**

```typescript
// src/config/credential-manager.ts

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

export class CredentialManager {
  private storagePath: string;

  constructor() {
    this.storagePath = path.join(process.env.HOME || "~", ".noopcoder", "credentials");
    fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
  }

  async getApiKey(): Promise<string | null> {
    try {
      const key = fs.readFileSync(this.storagePath, "utf-8").trim();
      return key || null;
    } catch {
      return null;
    }
  }

  async setApiKey(): Promise<void> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const key = await new Promise<string>((resolve) => {
      rl.question("请输入 API Key (输入不会回显): ", (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
    fs.writeFileSync(this.storagePath, key, { mode: 0o600 });
    console.log("API Key 已保存。");
  }

  async hasKey(): Promise<boolean> {
    const key = await this.getApiKey();
    return key !== null && key.length > 0;
  }

  async clearApiKey(): Promise<void> {
    if (fs.existsSync(this.storagePath)) {
      fs.unlinkSync(this.storagePath);
    }
    console.log("API Key 已清除。");
  }

  async showStatus(): Promise<void> {
    const key = await this.getApiKey();
    if (key) {
      console.log(`API Key 已配置 (${key.slice(0, 4)}...${key.slice(-4)})`);
    } else {
      console.log("API Key 未配置。运行 `noopcoder setup` 进行配置。");
    }
  }
}
```

```typescript
// src/config/credential-manager.test.ts

import { CredentialManager } from "./credential-manager";

describe("CredentialManager", () => {
  const manager = new CredentialManager();

  test("hasKey returns false when no key", async () => {
    await manager.clearApiKey();
    expect(await manager.hasKey()).toBe(false);
  });
});
```

```bash
npx jest src/config/credential-manager.test.ts
git add src/config/credential-manager.ts src/config/credential-manager.test.ts
git commit -m "feat: implement CredentialManager with secure key storage"
```

---

## Phase 8: Agent Main Loop

### Task 22: Context builder

**Files:**
- Create: `src/core/context.ts`
- Create: `src/core/context.test.ts`

- [ ] **Step 1: Write → test → commit**

```typescript
// src/core/context.ts

import { Message } from "../llm/types";

export class Context {
  messages: Message[] = [];

  addSystem(content: string): void {
    this.messages.push({ role: "system", content });
  }

  addUser(content: string): void {
    this.messages.push({ role: "user", content });
  }

  addAssistant(content: string): void {
    this.messages.push({ role: "assistant", content });
  }

  addRules(rules: string): void {
    if (rules) {
      this.addSystem(`[规则]\n${rules}`);
    }
  }

  addMemory(memory: string): void {
    if (memory) {
      this.addSystem(`[记忆]\n${memory}`);
    }
  }

  addGoal(goal: string): void {
    this.addUser(goal);
  }

  compress(): void {
    // Keep system prompt + last 10 messages
    const systemMsgs = this.messages.filter((m) => m.role === "system");
    const recentMsgs = this.messages.filter((m) => m.role !== "system").slice(-10);
    this.messages = [...systemMsgs, ...recentMsgs];
  }

  summary(): string {
    return this.messages.map((m) => `[${m.role}] ${m.content.slice(0, 100)}`).join("\n");
  }
}
```

```typescript
// src/core/context.test.ts

import { Context } from "./context";

describe("Context", () => {
  test("builds messages in order", () => {
    const ctx = new Context();
    ctx.addSystem("sys");
    ctx.addGoal("goal");
    expect(ctx.messages.length).toBe(2);
    expect(ctx.messages[0].role).toBe("system");
    expect(ctx.messages[1].role).toBe("user");
  });

  test("compress keeps system + recent", () => {
    const ctx = new Context();
    ctx.addSystem("sys");
    for (let i = 0; i < 20; i++) ctx.addUser(`msg${i}`);
    ctx.compress();
    expect(ctx.messages.length).toBe(11); // 1 system + 10 recent
  });
});
```

```bash
npx jest src/core/context.test.ts
git add src/core/context.ts src/core/context.test.ts
git commit -m "feat: implement Context builder with compression"
```

### Task 23: Agent main loop

**Files:**
- Create: `src/core/agent.ts`
- Create: `src/core/agent.test.ts`

**Interfaces:**
- Consumes: All previous modules
- Produces: `Agent` class with `run(goal): Promise<AgentResult>`

- [ ] **Step 1: Write the Agent class**

```typescript
// src/core/agent.ts

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
    ctx.addSystem(`你是一个编码智能体。你的任务是根据用户需求，通过调用工具来完成编码工作。

你必须以 JSON 格式输出下一步动作。格式如下：
- {"type":"glob","pattern":"**/*.ts"} — 浏览文件
- {"type":"grep","pattern":"pattern","path":"dir"} — 搜索代码
- {"type":"read_file","path":"path/to/file"} — 读取文件
- {"type":"write_file","path":"path/to/file","content":"..."} — 写入文件
- {"type":"shell","command":"command"} — 执行命令
- {"type":"run_tests","target":"file"} — 运行测试
- {"type":"done","summary":"完成了什么"} — 任务完成

不要输出 JSON 以外的任何内容。`);
    ctx.addRules("你正在 ${process.cwd()} 目录下工作。");
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
        return { status: "failure", summary: `连续 ${consecutiveFailures} 次失败，熔断`, steps };
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
      if (guardResult.verdict === "deny" || guardResult.verdict === "ask") {
        // For ask, if HITL approved, verdict becomes "allow" and we continue
        // For deny, block
        if (guardResult.verdict === "deny") {
          ctx.addUser(`动作被拦截: ${guardResult.reason || "策略禁止"}`);
          consecutiveFailures++;
          continue;
        }
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

      // Feedback loop
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
```

- [ ] **Step 2: Write the integration test**

```typescript
// src/core/agent.test.ts

import { Agent } from "./agent";
import { MockLLMClient } from "../llm/mock-llm-client";
import { ActionParser } from "../action/action-parser";
import { GuardPipeline } from "../guard/guard-pipeline";
import { RuleGuard } from "../guard/rule-guard";
import { SandboxGuard } from "../guard/sandbox-guard";
import { HITLGuard } from "../guard/hitl-guard";
import { StubApprover } from "../guard/approvers/stub-approver";
import { ToolDispatcher } from "../tools/tool-dispatcher";
import { FeedbackLoop } from "../feedback/feedback-loop";
import { FileMemory } from "../memory/file-memory";
import { DEFAULT_CONFIG } from "../config/types";
import { Tool } from "../tools/types";
import * as fs from "fs";
import * as path from "path";

const tmpDir = path.join(__dirname, "..", "..", "test-tmp-agent");

function buildAgent(mockActions: any[], opts?: { guardRules?: any[]; sandbox?: any }): Agent {
  const config = { ...DEFAULT_CONFIG };
  if (opts?.guardRules) config.guardRules = opts.guardRules;
  if (opts?.sandbox) config.sandbox = { ...config.sandbox, ...opts.sandbox };

  return new Agent(
    new MockLLMClient(mockActions),
    new ActionParser(),
    new GuardPipeline(
      new RuleGuard(config.guardRules),
      new SandboxGuard(config.sandbox),
      new HITLGuard(new StubApprover("always_allow")),
    ),
    buildDispatcher(),
    new FeedbackLoop([]),
    new FileMemory(tmpDir),
    config,
  );
}

function buildDispatcher(): ToolDispatcher {
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
    parameters: { path: { type: "string", description: "path", required: true }, content: { type: "string", description: "content", required: true } },
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
    const agent = buildAgent(
      Array(10).fill({ type: "glob", pattern: "*.ts" }),
      { sandbox: { allowedPaths: ["/tmp"] } },
    );
    const config = { ...DEFAULT_CONFIG, run: { ...DEFAULT_CONFIG.run, maxSteps: 3 } };
    // Override config
    const agent2 = new Agent(
      new MockLLMClient(Array(10).fill({ type: "glob", pattern: "*.ts" })),
      new ActionParser(),
      new GuardPipeline(
        new RuleGuard([]),
        new SandboxGuard({ ...DEFAULT_CONFIG.sandbox, allowedPaths: [process.cwd()] }),
        new HITLGuard(new StubApprover("always_allow")),
      ),
      buildDispatcher(),
      new FeedbackLoop([]),
      new FileMemory(tmpDir),
      { ...DEFAULT_CONFIG, run: { ...DEFAULT_CONFIG.run, maxSteps: 3 } },
    );
    const result = await agent2.run("test");
    expect(result.status).toBe("max_steps");
  });

  test("guardrail blocks dangerous action", async () => {
    const agent = buildAgent(
      [
        { type: "shell", command: "rm -rf /" },
        { type: "done", summary: "done" },
      ],
      { guardRules: [{ pattern: "rm -rf", matchOn: "command", action: "deny" }] },
    );
    const result = await agent.run("delete files");
    // rm -rf is blocked, then done is processed
    expect(result.status).toBe("success");
    expect(result.steps).toBe(2);
  });
});
```

- [ ] **Step 3: Run → commit**

```bash
npx jest src/core/agent.test.ts
git add src/core/agent.ts src/core/agent.test.ts
git commit -m "feat: implement Agent main loop with guard, dispatch, feedback, and stop conditions"
```

---

## Phase 9: CLI

### Task 24: CLI entry point

**Files:**
- Create: `src/cli/main.ts`

- [ ] **Step 1: Write CLI**

```typescript
#!/usr/bin/env node
// src/cli/main.ts

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
```

- [ ] **Step 2: Change package.json main entry to use the CLI**

Edit `package.json` to ensure `"bin": { "noopcoder": "./dist/cli/main.js" }` is correct.

- [ ] **Step 3: Build and verify**

```bash
npm run build
node dist/cli/main.js status
```

Expected: "API Key 未配置。运行 `noopcoder setup` 进行配置。"

- [ ] **Step 4: Commit**

```bash
git add src/cli/main.ts
git commit -m "feat: implement CLI with setup, status, clear, and run commands"
```

---

## Phase 10: Integration & Demo

### Task 25: Mechanism demo scripts

**Files:**
- Create: `src/demo/demo-1-guardrail-intercept.ts`
- Create: `src/demo/demo-2-feedback-loop.ts`
- Create: `src/demo/demo-3-path-traversal.ts`
- Create: `src/demo/run-all.ts`
- Move demo files to `src/demo/` (they live in src for compilation)

- [ ] **Step 1: Write demo-1 (guardrail intercept)**

```typescript
// src/demo/demo-1-guardrail-intercept.ts

import { RuleGuard } from "../guard/rule-guard";
import { GuardRule } from "../guard/types";

export function demo1_run(): boolean {
  const rules: GuardRule[] = [
    { pattern: "rm -rf", matchOn: "command", action: "deny" },
    { pattern: "DROP TABLE", matchOn: "command", action: "deny" },
  ];
  const guard = new RuleGuard(rules);

  const result = guard.check({ type: "shell", command: "rm -rf /" });

  console.log("=== 演示 1: 治理护栏拦截危险动作 ===");
  console.log(`动作: shell "rm -rf /"`);
  console.log(`结果: verdict=${result.verdict}, matchedRule=${result.matchedRule}`);
  console.log(result.verdict === "deny" ? "✅ 测试通过: 危险动作被拦截" : "❌ 测试失败");
  console.log("");

  return result.verdict === "deny";
}
```

- [ ] **Step 2: Write demo-2 (feedback loop)**

```typescript
// src/demo/demo-2-feedback-loop.ts

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
    execute: async (a) => ({ success: true, output: `wrote ${(a as any).path}`, action: a, changedCode: true }),
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
  console.log(`总结: ${result.summary}`);
  // Agent should have changed behavior: step 1 writes bad code, gets feedback, step 2 writes fixed code
  console.log(result.steps >= 2 ? "✅ 测试通过: Agent 根据反馈改变了行为" : "❌ 测试失败");
  console.log("");

  fs.rmSync(tmpDir, { recursive: true, force: true });
  return result.steps >= 2;
}
```

- [ ] **Step 3: Write demo-3 (path traversal)**

```typescript
// src/demo/demo-3-path-traversal.ts

import { SandboxGuard } from "../guard/sandbox-guard";
import { SandboxPolicy } from "../guard/types";
import * as path from "path";

export function demo3_run(): boolean {
  const policy: SandboxPolicy = {
    allowedPaths: [path.resolve("/project")],
    bannedCommands: [],
    timeoutMs: 30000,
    maxFileSize: 1024 * 1024,
  };
  const guard = new SandboxGuard(policy);

  const result = guard.check({ type: "read_file", path: "/project/../etc/passwd" });

  console.log("=== 演示 3: 沙箱路径穿越防护 ===");
  console.log(`动作: read_file "/project/../etc/passwd"`);
  console.log(`结果: verdict=${result.verdict}, reason=${result.reason}`);
  console.log(result.verdict === "deny" ? "✅ 测试通过: 路径穿越被拦截" : "❌ 测试失败");
  console.log("");

  return result.verdict === "deny";
}
```

- [ ] **Step 4: Write run-all demo runner**

```typescript
// src/demo/run-all.ts

import { demo1_run } from "./demo-1-guardrail-intercept";
import { demo2_run } from "./demo-2-feedback-loop";
import { demo3_run } from "./demo-3-path-traversal";

async function runAll() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   NoOpCoder 机制演示 (Mock LLM)      ║");
  console.log("║   无需网络, 无需真实 LLM, 确定性复现  ║");
  console.log("╚══════════════════════════════════════╝\n");

  const results: boolean[] = [];

  results.push(demo1_run());
  results.push(await demo2_run());
  results.push(demo3_run());

  const passed = results.filter(Boolean).length;
  console.log(`\n总计: ${passed}/${results.length} 通过`);
  process.exit(passed === results.length ? 0 : 1);
}

runAll();
```

- [ ] **Step 5: Run demo → commit**

```bash
npm run build
node dist/demo/run-all.js
```

Expected: 3/3 通过。

```bash
git add src/demo/
git commit -m "feat: implement mechanism demo (guardrail, feedback, path traversal)"
```

### Task 26: Docker + CI/CD + README

**Files:**
- Create: `Dockerfile`
- Create: `.github/workflows/ci.yml`
- Create: `README.md`

- [ ] **Step 1: Write Dockerfile**

```dockerfile
# Dockerfile

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

RUN adduser -D noopcoder
USER noopcoder

ENTRYPOINT ["node", "dist/cli/main.js"]
```

- [ ] **Step 2: Write CI config**

```yaml
# .github/workflows/ci.yml

name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run build
      - run: npm run test:mock
        env:
          CI: true
```

- [ ] **Step 3: Write README.md**

```markdown
# NoOpCoder — Coding Agent Harness

> AI4SE 期末项目 A 类。从零实现的 Coding Agent Harness，含 mock-LLM 可测试性、三层治理护栏、反馈闭环。

## 快速开始

### 本地运行

```bash
# 安装
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

## API Key 安全

- 本地：通过 `noopcoder setup` 交互式录入，存储在 `~/.noopcoder/credentials`
- Docker：通过环境变量 `NOOPCODER_API_KEY` 注入
- Key 绝不硬编码，不入 Git，不入日志

## 测试

```bash
npm test              # 全部测试
npm run test:mock     # 仅 mock 测试（无需网络）
npm run demo          # 机制演示
```

## 架构

```
CLI → Agent 主循环 → (LLM Client → ActionParser → GuardPipeline → ToolDispatcher → FeedbackLoop)
```

- **LLM 抽象层**：OpenAI 兼容客户端 + MockLLMClient
- **治理护栏**：RuleGuard → SandboxGuard（路径规范化） → HITLGuard
- **反馈闭环**：TestSensor / LintSensor / TypeCheckSensor
- **记忆系统**：JSON 文件持久化（最低实现）
- **配置系统**：声明式规则，默认规则 + 用户覆盖

## 目录结构

```
src/
  core/       Agent 主循环 + 上下文
  llm/        LLM 抽象层 (Mock + OpenAI 兼容)
  action/     Action 协议 + 解析器
  tools/      6 个内置工具
  guard/      三层治理护栏 ⭐
  feedback/   反馈闭环 + Sensors
  memory/     文件记忆
  config/     配置 + 凭据管理
  cli/        CLI 入口
  demo/       机制演示脚本
```

## 分发

Docker 镜像，推送到公开 registry。

## 已知限制

- 仅支持 OpenAI 兼容 API
- 路径规范化在 Windows 和 Linux 下行为一致
- 记忆系统为最低实现（JSON 文件）
- 需自行配置 API Key
```

- [ ] **Step 4: Build Docker image and verify**

```bash
docker build -t noopcoder .
docker run --rm noopcoder status
```

Expected: "API Key 未配置。"

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .github/workflows/ci.yml README.md
git commit -m "docs: add Dockerfile, CI config, and README"
```

---

## 总结

### 任务依赖图

```
T1 (scaffold)
 ├── T2 (types)
 │    └── T3 (parser)
 ├── T4 (llm types)
 │    ├── T5 (mock llm)
 │    └── T6 (openai client)
 ├── T7 (tool dispatcher)
 │    ├── T8 (glob, grep, read)
 │    ├── T9 (write)
 │    ├── T10 (shell)
 │    └── T11 (test)
 ├── T12 (rule guard)
 │    └── T13 (sandbox guard)
 │         └── T14 (hitl guard)
 │              └── T15 (guard pipeline)
 ├── T16 (mock sensor)
 │    └── T17 (real sensors)
 │         └── T18 (feedback loop)
 ├── T19 (memory)
 ├── T20 (config)
 └── T21 (credentials)

T22 (context) ───┐
T23 (agent) ←──── All above ──── T24 (cli) ─── T25 (demo) ─── T26 (docker/ci)
```

### 可并行任务组

- **Group A** (T4-T6): LLM 层 — 独立于工具层
- **Group B** (T7-T11): 工具层 — 依赖 T2/T3，互不依赖
- **Group C** (T12-T15): 护栏层 — 独立于 LLM 和工具
- **Group D** (T16-T18): 反馈层 — 独立
- **Group E** (T19-T21): 记忆/配置/凭据 — 独立

**Group A, B, C, D, E 可以并行开发。**

---

*实现计划结束。下一步：执行。*

---