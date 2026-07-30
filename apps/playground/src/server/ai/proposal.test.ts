import { describe, expect, it } from "vitest";
import { parseModelActionProposal, parseModelIntentProposal } from "./proposal";

describe("OpenAI-compatible proposal normalization", () => {
  it("accepts StepFun string literals while preserving the strict Intent contract", () => {
    const intent = parseModelIntentProposal(
      JSON.stringify({
        version: "1",
        operation: "transfer",
        chainId: "143",
        asset: { type: "native", token: "native", symbol: "MON", decimals: "18" },
        amount: 0.002,
        recipient: {
          address: "0x1111111111111111111111111111111111111111",
          resolutionSource: "user-input",
        },
      }),
    );
    expect(intent).toMatchObject({ version: 1, chainId: 143, amount: "0.002" });
  });

  it("normalizes action literals but still rejects unsupported semantics", () => {
    const action = parseModelActionProposal(
      JSON.stringify({
        version: "1",
        operation: "swap",
        chainId: "143",
        sender: "0xcccccccccccccccccccccccccccccccccccccccc",
        protocol: "kuru",
        tokenIn: "native",
        tokenOut: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
        amountIn: 1,
        slippageBps: "50",
      }),
    );
    expect(action).toMatchObject({ version: 1, chainId: 143, amountIn: "1", slippageBps: 50 });
    expect(() =>
      parseModelIntentProposal(JSON.stringify({ version: "2", operation: "bridge" })),
    ).toThrow();
  });
});
