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