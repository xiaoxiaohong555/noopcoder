import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

export class CredentialManager {
  private storagePath: string;

  constructor() {
    this.storagePath = path.join(process.env.HOME || "~", ".noopcoder", "credentials");
    fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
  }

  async getApiKey(): Promise<string | null> {
    try {
      const key = fs.readFileSync(this.storagePath, "utf-8").trim();
      return key || null;
    } catch {
      return null;
    }
  }

  async setApiKey(): Promise<void> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const key = await new Promise<string>((resolve) => {
      rl.question("请输入 API Key (输入不会回显): ", (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
    fs.writeFileSync(this.storagePath, key, { mode: 0o600 });
    console.log("API Key 已保存。");
  }

  async hasKey(): Promise<boolean> {
    const key = await this.getApiKey();
    return key !== null && key.length > 0;
  }

  async clearApiKey(): Promise<void> {
    if (fs.existsSync(this.storagePath)) {
      fs.unlinkSync(this.storagePath);
    }
    console.log("API Key 已清除。");
  }

  async showStatus(): Promise<void> {
    const key = await this.getApiKey();
    if (key) {
      console.log(`API Key 已配置 (${key.slice(0, 4)}...${key.slice(-4)})`);
    } else {
      console.log("API Key 未配置。运行 \`noopcoder setup\` 进行配置。");
    }
  }
}