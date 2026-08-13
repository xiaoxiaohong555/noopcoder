import { Context } from "./context";

describe("Context", () => {
  test("builds messages in order", () => {
    const ctx = new Context();
    ctx.addSystem("sys");
    ctx.addGoal("goal");
    expect(ctx.messages.length).toBe(2);
    expect(ctx.messages[0].role).toBe("system");
    expect(ctx.messages[1].role).toBe("user");
  });

  test("compress keeps system + recent", () => {
    const ctx = new Context();
    ctx.addSystem("sys");
    for (let i = 0; i < 20; i++) ctx.addUser(`msg${i}`);
    ctx.compress();
    expect(ctx.messages.length).toBe(11); // 1 system + 10 recent
  });
});