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
  changedCode: boolean;
  error?: string;
}