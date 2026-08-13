// ─── Guard Types ───────────────────────────────────────

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