import type { AgentAction, Intent } from "../../types/domain";
import { actionSchema, intentSchema } from "../../types/domain";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Model proposal must be a JSON object");
  }
  return { ...(value as JsonObject) };
}

function numericLiteral(value: unknown, expected: number) {
  return value === String(expected) ? expected : value;
}

function decimalString(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  if (Number.isInteger(value) && !Number.isSafeInteger(value)) return value;
  return String(value);
}

function integer(value: unknown) {
  return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
}

function normalizeAsset(value: unknown) {
  const asset = object(value);
  return { ...asset, decimals: integer(asset.decimals) };
}

export function parseModelIntentProposal(proposalJson: string): Intent {
  const proposal = object(JSON.parse(proposalJson));
  const normalized: JsonObject = {
    ...proposal,
    version: numericLiteral(proposal.version, 1),
    chainId: numericLiteral(proposal.chainId, 143),
  };
  if (proposal.operation === "transfer") {
    normalized.amount = decimalString(proposal.amount);
    normalized.asset = normalizeAsset(proposal.asset);
  } else if (proposal.operation === "approval") {
    normalized.maxAmountDisplay = decimalString(proposal.maxAmountDisplay);
    normalized.token = normalizeAsset(proposal.token);
  } else if (proposal.operation === "swap") {
    normalized.amountIn = decimalString(proposal.amountIn);
    normalized.maxSlippageBps = integer(proposal.maxSlippageBps);
    normalized.tokenIn = normalizeAsset(proposal.tokenIn);
    normalized.tokenOut = normalizeAsset(proposal.tokenOut);
  }
  return intentSchema.parse(normalized);
}

export function parseModelActionProposal(proposalJson: string): AgentAction {
  const proposal = object(JSON.parse(proposalJson));
  const normalized: JsonObject = {
    ...proposal,
    version: numericLiteral(proposal.version, 1),
    chainId: numericLiteral(proposal.chainId, 143),
  };
  if (proposal.operation === "transfer") {
    normalized.amount = decimalString(proposal.amount);
  } else if (proposal.operation === "approval") {
    normalized.amountBaseUnits = decimalString(proposal.amountBaseUnits);
  } else if (proposal.operation === "swap") {
    normalized.amountIn = decimalString(proposal.amountIn);
    normalized.slippageBps = integer(proposal.slippageBps);
  }
  return actionSchema.parse(normalized);
}
