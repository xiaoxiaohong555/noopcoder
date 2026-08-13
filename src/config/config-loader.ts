import * as fs from "fs";
import * as path from "path";
import { Config, DEFAULT_CONFIG } from "./types";

export class ConfigLoader {
  static load(configPath?: string): Config {
    const defaultPath = configPath || path.join(process.env.HOME || "~", ".noopcoder", "config.json");
    try {
      const raw = fs.readFileSync(defaultPath, "utf-8");
      const userConfig = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...userConfig };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }
}