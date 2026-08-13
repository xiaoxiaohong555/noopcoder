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