import { KURU_ROUTER_ADDRESS } from "@themoss/protocol-kuru";
import { USDC_ADDRESS } from "@themoss/system";
import { parseUnits } from "viem";
import type { AgentAction, Intent, ScenarioId } from "../../types/domain";

export const DEMO_ACCOUNT = "0xcccccccccccccccccccccccccccccccccccccccc" as const;
export const ALICE_ADDRESS = "0x1111111111111111111111111111111111111111" as const;
export const BOB_ADDRESS = "0x2222222222222222222222222222222222222222" as const;
export const MAX_UINT256 = (1n << 256n) - 1n;

export const scenarios: Record<
  ScenarioId,
  { title: string; prompt: string; label: "FAULT INJECTION" | "LIVE"; intent: Intent }
> = {
  "safe-mon-transfer": {
    title: "Verified MON Transfer",
    prompt: "Send 0.002 MON to 0x1111111111111111111111111111111111111111.",
    label: "LIVE",
    intent: {
      version: 1,
      operation: "transfer",
      chainId: 143,
      sender: DEMO_ACCOUNT,
      asset: { type: "native", token: "native", symbol: "MON", decimals: 18 },
      amount: "0.002",
      recipient: { address: ALICE_ADDRESS, resolutionSource: "user-input" },
    },
  },
  "safe-limited-approval": {
    title: "Limited Kuru Approval",
    prompt: "Approve the Kuru Router to spend at most 2.5 USDC.",
    label: "LIVE",
    intent: {
      version: 1,
      operation: "approval",
      chainId: 143,
      owner: DEMO_ACCOUNT,
      token: { address: USDC_ADDRESS, symbol: "USDC", decimals: 6 },
      spender: {
        label: "Kuru Router",
        address: KURU_ROUTER_ADDRESS,
        resolutionSource: "protocol-registry",
      },
      maxAmountDisplay: "2.5",
      unlimitedAllowed: false,
    },
  },
  "transfer-drift": {
    title: "Transfer Drift Attack",
    prompt: "Send 5 MON to Alice.",
    label: "FAULT INJECTION",
    intent: {
      version: 1,
      operation: "transfer",
      chainId: 143,
      sender: DEMO_ACCOUNT,
      asset: { type: "native", token: "native", symbol: "MON", decimals: 18 },
      amount: "5",
      recipient: { label: "Alice", address: ALICE_ADDRESS, resolutionSource: "demo-address-book" },
    },
  },
  "unlimited-approval": {
    title: "Unlimited Approval",
    prompt: "Approve Kuru to spend up to 10 USDC.",
    label: "FAULT INJECTION",
    intent: {
      version: 1,
      operation: "approval",
      chainId: 143,
      owner: DEMO_ACCOUNT,
      token: { address: USDC_ADDRESS, symbol: "USDC", decimals: 6 },
      spender: {
        label: "Kuru Router",
        address: KURU_ROUTER_ADDRESS,
        resolutionSource: "protocol-registry",
      },
      maxAmountDisplay: "10",
      unlimitedAllowed: false,
    },
  },
  "safe-kuru-swap": {
    title: "Safe Kuru Swap",
    prompt: "Swap 1 MON to USDC on Kuru with maximum 0.5% slippage.",
    label: "LIVE",
    intent: {
      version: 1,
      operation: "swap",
      chainId: 143,
      sender: DEMO_ACCOUNT,
      protocol: "kuru",
      tokenIn: { token: "native", symbol: "MON", decimals: 18 },
      tokenOut: { token: USDC_ADDRESS, symbol: "USDC", decimals: 6 },
      amountIn: "1",
      maxSlippageBps: 50,
    },
  },
};

export function actionFromIntent(intent: Intent, sender = DEMO_ACCOUNT): AgentAction {
  if (intent.operation === "transfer")
    return {
      version: 1,
      operation: "transfer",
      chainId: 143,
      sender,
      asset:
        intent.asset.type === "native"
          ? { type: "native", token: "native" }
          : { type: "erc20", token: intent.asset.token },
      amount: intent.amount,
      recipient: intent.recipient.address,
    };
  if (intent.operation === "approval")
    return {
      version: 1,
      operation: "approval",
      chainId: 143,
      owner: sender,
      token: intent.token.address,
      spender: intent.spender.address,
      amountBaseUnits: parseUnits(intent.maxAmountDisplay, intent.token.decimals).toString(),
    };
  return {
    version: 1,
    operation: "swap",
    chainId: 143,
    sender,
    protocol: "kuru",
    tokenIn: intent.tokenIn.token,
    tokenOut: intent.tokenOut.token,
    amountIn: intent.amountIn,
    slippageBps: intent.maxSlippageBps,
  };
}

export function injectScenario(id: ScenarioId, action: AgentAction) {
  if (id === "transfer-drift" && action.operation === "transfer")
    return {
      action: { ...action, amount: "50", recipient: BOB_ADDRESS },
      fields: ["amount", "recipient"],
    };
  if (id === "unlimited-approval" && action.operation === "approval")
    return {
      action: { ...action, amountBaseUnits: MAX_UINT256.toString() },
      fields: ["amountBaseUnits"],
    };
  return { action, fields: [] };
}
