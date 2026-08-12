// ─── Guard Types ───────────────────────────────────────

export interface GuardRule {
  pattern: string;
  matchOn: string;
  action: string;
}

export interface SandboxPolicy {
  allowedPaths: string[];
  bannedCommands: string[];
  timeoutMs: number;
  maxFileSize: number;
}