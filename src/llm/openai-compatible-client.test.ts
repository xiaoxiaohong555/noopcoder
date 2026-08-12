jest.mock("openai", () => {
  const mockCreate = jest.fn().mockResolvedValue({
    choices: [{ message: { content: '{"type":"done","summary":"ok"}' }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });
  const MockOpenAI = function (this: any) {
    this.chat = {
      completions: {
        create: mockCreate,
      },
    };
  };
  return {
    __esModule: true,
    default: MockOpenAI,
  };
});

import { OpenAICompatibleClient } from "./openai-compatible-client";

describe("OpenAICompatibleClient", () => {
  test("calls API with correct config", async () => {
    const client = new OpenAICompatibleClient({
      model: "glm-5.2",
      apiEndpoint: "https://njusehub.info/v1",
      temperature: 0.7,
      maxTokens: 4096,
    }, "test-api-key");

    const response = await client.complete([{ role: "user", content: "hello" }]);
    expect(response.content).toBe('{"type":"done","summary":"ok"}');
    expect(response.finishReason).toBe("stop");
    expect(response.usage.totalTokens).toBe(15);
  });
});