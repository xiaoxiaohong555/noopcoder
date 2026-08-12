import { Sensor, Feedback } from "./types";
import { Action, ToolResult } from "../action/types";

export class FeedbackLoop {
  constructor(private sensors: Sensor[]) {}

  async evaluate(_action: Action, result: ToolResult): Promise<Feedback | null> {
    if (!result.changedCode) return null;

    const allFeedback: Feedback[] = [];
    for (const sensor of this.sensors) {
      const output = await sensor.run();
      const feedback = sensor.parse(output);
      if (feedback.hasFailures) {
        allFeedback.push(feedback);
      }
    }

    if (allFeedback.length === 0) return null;

    const totalFailures = allFeedback.reduce((sum, f) => sum + f.failureCount, 0);
    return {
      hasFailures: true,
      message: allFeedback.map((f) => f.message).join("\n\n"),
      failureCount: totalFailures,
    };
  }
}