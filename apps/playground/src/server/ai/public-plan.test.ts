import { describe, expect, it } from "vitest";
import { publicPlan } from "./public-plan";

describe("public agent plan", () => {
  it("does not present signing or transaction submission as agent behavior", () => {
    const plan = publicPlan("action", ["验证授权参数", "构建并发送授权交易", "等待链上确认"], "zh");
    expect(plan.join(" ")).not.toMatch(/发送|自动签名|等待链上确认/);
    expect(plan).toContain("构建未签名操作参数");
    expect(plan.at(-1)).toContain("MossGuard 确定性核验");
  });

  it("preserves a safe model-authored public plan", () => {
    const plan = ["Resolve the approved token", "Construct unsigned parameters"];
    expect(publicPlan("action", plan, "en")).toEqual(plan);
  });
});
