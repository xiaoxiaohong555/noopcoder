export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export interface LLMConfig {
  model: string;
  apiEndpoint: string;
  temperature: number;
  maxTokens: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content: string;
  finishReason: "stop" | "length" | "error";
  usage: TokenUsage;
}

export interface LLMClient {
  complete(messages: Message[], tools?: ToolDefinition[]): Promise<LLMResponse>;
}