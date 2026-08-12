import OpenAI from "openai";
import { LLMClient, LLMConfig, LLMResponse, Message, ToolDefinition } from "./types";

export class OpenAICompatibleClient implements LLMClient {
  private client: OpenAI;
  private config: LLMConfig;

  constructor(config: LLMConfig, apiKey: string) {
    this.config = config;
    this.client = new OpenAI({ apiKey, baseURL: config.apiEndpoint });
  }

  async complete(messages: Message[], _tools?: ToolDefinition[]): Promise<LLMResponse> {
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