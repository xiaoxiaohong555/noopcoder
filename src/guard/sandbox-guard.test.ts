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