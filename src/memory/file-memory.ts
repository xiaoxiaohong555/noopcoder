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
    fs.writeFileSync(path.join(this.basePath, `${entry.id}.json`), JSON.stringify(entry, null, 2));
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