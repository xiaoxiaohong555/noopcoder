import { demo1_run } from "./demo-1-guardrail-intercept";
import { demo2_run } from "./demo-2-feedback-loop";
import { demo3_run } from "./demo-3-path-traversal";

async function runAll() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   NoOpCoder 机制演示 (Mock LLM)      ║");
  console.log("║   无需网络, 无需真实 LLM, 确定性复现  ║");
  console.log("╚══════════════════════════════════════╝\n");

  const results: boolean[] = [];

  results.push(demo1_run());
  results.push(await demo2_run());
  results.push(demo3_run());

  const passed = results.filter(Boolean).length;
  console.log(`\n总计: ${passed}/${results.length} 通过`);
  process.exit(passed === results.length ? 0 : 1);
}

runAll();