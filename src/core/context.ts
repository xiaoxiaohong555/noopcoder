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
    const systemMsgs = this.messages.filter((m) => m.role === "system");
    const recentMsgs = this.messages.filter((m) => m.role !== "system").slice(-10);
    this.messages = [...systemMsgs, ...recentMsgs];
  }

  summary(): string {
    return this.messages.map((m) => `[${m.role}] ${m.content.slice(0, 100)}`).join("\n");
  }
}