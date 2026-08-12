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
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    };
  }
}