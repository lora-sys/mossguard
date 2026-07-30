export function publicPlan(phase: "intent" | "action", proposed: unknown, locale: "zh" | "en") {
  const steps = Array.isArray(proposed) ? proposed.map(String).slice(0, 4) : [];
  const unsafe =
    /\b(send|submit|broadcast|sign|confirm onchain)\b|发送|提交交易|广播|签名|等待链上确认/i;
  if (steps.length >= 2 && steps.every((step) => !unsafe.test(step))) return steps;
  if (locale === "en")
    return phase === "intent"
      ? [
          "Extract the explicitly authorized asset, limit and counterparty",
          "Create a structured Intent draft",
          "Wait for the user to confirm the authorization boundary",
        ]
      : [
          "Propose an operation from the confirmed Intent",
          "Construct unsigned operation parameters",
          "Hand off to Moss simulation and deterministic MossGuard verification",
        ];
  return phase === "intent"
    ? ["提取用户明确授权的资产、额度与对象", "生成结构化 Intent 草案", "等待用户检查并确认授权边界"]
    : [
        "根据已确认 Intent 提议具体操作",
        "构建未签名操作参数",
        "交由 Moss 模拟并由 MossGuard 确定性核验",
      ];
}
