import { CredentialManager } from "./credential-manager";

describe("CredentialManager", () => {
  const manager = new CredentialManager();

  test("hasKey returns false when no key", async () => {
    await manager.clearApiKey();
    expect(await manager.hasKey()).toBe(false);
  });
});