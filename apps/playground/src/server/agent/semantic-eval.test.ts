import { describe, expect, it } from "vitest";
import { parseModelActionProposal, parseModelIntentProposal } from "../ai/proposal";

const ADDRESS = "0x1111111111111111111111111111111111111111";
const USDC = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";
const KURU = "0xd651346d7c789536ebf06dc72aE3C8502cd695CC";

describe("Agent semantic contract corpus", () => {
  it.each([
    {
      name: "Chinese capped approval remains finite",
      prompt: "授权 Kuru 最多使用 10 USDC",
      proposal: {
        version: 1,
        operation: "approval",
        chainId: 143,
        token: { address: USDC, symbol: "USDC", decimals: 6 },
        spender: { label: "Kuru Router", address: KURU, resolutionSource: "protocol-registry" },
        maxAmountDisplay: "10",
        unlimitedAllowed: false,
      },
      expected: { operation: "approval", maxAmountDisplay: "10", unlimitedAllowed: false },
    },
    {
      name: "English transfer preserves the explicit recipient",
      prompt: `Send 0.002 MON to ${ADDRESS}`,
      proposal: {
        version: 1,
        operation: "transfer",
        chainId: 143,
        asset: { type: "native", token: "native", symbol: "MON", decimals: 18 },
        amount: "0.002",
        recipient: { address: ADDRESS, resolutionSource: "user-input" },
      },
      expected: { operation: "transfer", amount: "0.002" },
    },
    {
      name: "Kuru swap preserves exact input and slippage",
      prompt: "在 Kuru 将 1 MON 兑换为 USDC，最大滑点 0.5%",
      proposal: {
        version: 1,
        operation: "swap",
        chainId: 143,
        protocol: "kuru",
        tokenIn: { token: "native", symbol: "MON", decimals: 18 },
        tokenOut: { token: USDC, symbol: "USDC", decimals: 6 },
        amountIn: "1",
        maxSlippageBps: 50,
      },
      expected: { operation: "swap", amountIn: "1", maxSlippageBps: 50 },
    },
  ])("accepts $name", ({ prompt, proposal, expected }) => {
    expect(prompt.length).toBeGreaterThan(0);
    expect(parseModelIntentProposal(JSON.stringify(proposal))).toMatchObject(expected);
  });

  it("keeps the confirmed 10 USDC action at 10,000,000 base units", () => {
    const action = parseModelActionProposal(
      JSON.stringify({
        version: 1,
        operation: "approval",
        chainId: 143,
        owner: ADDRESS,
        token: USDC,
        spender: KURU,
        amountBaseUnits: "10000000",
      }),
    );
    expect(action).toMatchObject({ operation: "approval", amountBaseUnits: "10000000" });
  });

  it.each([
    ["unsupported bridge", { version: 1, operation: "bridge", chainId: 143 }],
    [
      "unbounded approval intent",
      {
        version: 1,
        operation: "approval",
        chainId: 143,
        token: { address: USDC, decimals: 6 },
        spender: { address: KURU, resolutionSource: "protocol-registry" },
        maxAmountDisplay: "10",
        unlimitedAllowed: true,
      },
    ],
  ])("rejects %s", (_name, proposal) => {
    expect(() => parseModelIntentProposal(JSON.stringify(proposal))).toThrow();
  });
});
