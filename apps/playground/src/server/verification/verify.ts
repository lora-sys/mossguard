import {
  type CapabilityNode,
  flattenCapabilityTree,
  type JsonSafeValue,
  type Receipt,
} from "@themoss/core";
import type { SimulateOutcome } from "@themoss/simulator";
import { parseUnits } from "viem";
import type {
  ConfirmedIntent,
  ProposedAction,
  VerificationCheck,
  VerificationReport,
} from "../../types/domain";

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const text = (value: unknown) =>
  typeof value === "string" || typeof value === "bigint" ? String(value) : JSON.stringify(value);

export function verifyExecution(input: {
  intent: ConfirmedIntent;
  action: ProposedAction;
  capability: CapabilityNode;
  simulation: SimulateOutcome;
  executionAccount: `0x${string}`;
  mossCommit: string;
}): VerificationReport {
  const { intent, action, capability, simulation, executionAccount } = input;
  const checks: VerificationCheck[] = [];
  const check = (
    id: string,
    field: string,
    ok: boolean,
    expected: unknown,
    actual: unknown,
    unavailable = false,
  ) =>
    checks.push({
      id,
      field,
      status: unavailable ? "unavailable" : ok ? "passed" : "failed",
      expected: text(expected),
      actual: text(actual),
      message: ok
        ? `${field} matches confirmed intent`
        : unavailable
          ? `${field} evidence is unavailable`
          : `${field} exceeds or differs from confirmed intent`,
    });
  const executable = flattenCapabilityTree(capability);
  check(
    "integrity.count",
    "Transaction count",
    executable.length === simulation.results.length,
    executable.length,
    simulation.results.length,
    executable.length !== simulation.results.length,
  );
  if (simulation.halted)
    check("integrity.halted", "Simulation", false, "complete", simulation.halted.reason, true);
  for (const [index, result] of simulation.results.entries()) {
    const expected = executable[index];
    check(
      `integrity.binding.${index}`,
      "Capability binding",
      Boolean(
        expected &&
          result.protocol === expected.capability.protocol &&
          result.method === expected.capability.method &&
          JSON.stringify(result.transaction) === JSON.stringify(expected.transaction),
      ),
      expected ? `${expected.capability.protocol}.${expected.capability.method}` : "transaction",
      `${result.protocol}.${result.method}`,
      !expected,
    );
    if (result.reverted)
      check(
        `integrity.revert.${index}`,
        "Simulation revert",
        false,
        "not reverted",
        result.revertReason ?? "reverted",
        true,
      );
    if (result.warnings.length)
      check(
        `integrity.warning.${index}`,
        "Warnings",
        false,
        "none",
        result.warnings.map((warning) => warning.code).join(", "),
        true,
      );
    if (!result.receipt)
      check(`integrity.receipt.${index}`, "Receipt", false, "structured receipt", "missing", true);
  }
  check(
    "operation",
    "Operation",
    intent.operation === action.action.operation,
    intent.operation,
    action.action.operation,
  );
  verifyIntentAction(intent, action.action, check);
  const rootResult = simulation.results.at(-1);
  if (rootResult?.receipt)
    verifyOutcome(intent, action.action, rootResult.receipt, executionAccount, check);
  const unknown = collectUnknownUserEffects(
    simulation.results.flatMap((result) => (result.receipt ? [result.receipt] : [])),
    executionAccount,
  );
  if (unknown.length)
    check("effects.unknown", "Unknown asset effects", false, "none", unknown.join(", "), true);
  const unavailableReasons = checks.filter((item) => item.status === "unavailable");
  const violations = checks.filter((item) => item.status === "failed");
  const decision = unavailableReasons.length
    ? "unavailable"
    : violations.length
      ? "blocked"
      : "verified";
  return {
    reportId: crypto.randomUUID(),
    decision,
    intentId: intent.intentId,
    intentHash: intent.intentHash,
    actionId: action.actionId,
    actionHash: action.actionHash,
    chainId: 143,
    executionAccount,
    checks,
    violations,
    unavailableReasons,
    evidenceSummary: {
      transactionCount: simulation.results.length,
      receiptCount: simulation.results.filter((result) => result.receipt).length,
      warningCount: simulation.results.reduce((sum, result) => sum + result.warnings.length, 0),
      protocols: [...new Set(simulation.results.map((result) => result.protocol))],
    },
    generatedAt: new Date().toISOString(),
    verifier: {
      name: "MossGuard",
      version: "0.1.0",
      mossRepository: "nishuzumi/moss",
      mossCommit: input.mossCommit,
    },
  };
}

type Check = (
  id: string,
  field: string,
  ok: boolean,
  expected: unknown,
  actual: unknown,
  unavailable?: boolean,
) => void;
function verifyIntentAction(
  intent: ConfirmedIntent,
  action: ProposedAction["action"],
  check: Check,
) {
  if (intent.operation === "transfer" && action.operation === "transfer") {
    check(
      "action.recipient",
      "Recipient",
      eq(intent.recipient.address, action.recipient),
      intent.recipient.address,
      action.recipient,
    );
    check("action.amount", "Amount", intent.amount === action.amount, intent.amount, action.amount);
    check(
      "action.asset",
      "Asset",
      eq(intent.asset.token, action.asset.token),
      intent.asset.token,
      action.asset.token,
    );
  }
  if (intent.operation === "approval" && action.operation === "approval") {
    const max = parseUnits(intent.maxAmountDisplay, intent.token.decimals);
    check(
      "action.token",
      "Token",
      eq(intent.token.address, action.token),
      intent.token.address,
      action.token,
    );
    check(
      "action.spender",
      "Spender",
      eq(intent.spender.address, action.spender),
      intent.spender.address,
      action.spender,
    );
    check(
      "action.approval",
      "Approval amount",
      BigInt(action.amountBaseUnits) <= max,
      max,
      action.amountBaseUnits,
    );
  }
  if (intent.operation === "swap" && action.operation === "swap") {
    check("action.protocol", "Protocol", action.protocol === "kuru", "kuru", action.protocol);
    check(
      "action.tokenIn",
      "Token in",
      eq(intent.tokenIn.token, action.tokenIn),
      intent.tokenIn.token,
      action.tokenIn,
    );
    check(
      "action.tokenOut",
      "Token out",
      eq(intent.tokenOut.token, action.tokenOut),
      intent.tokenOut.token,
      action.tokenOut,
    );
    check(
      "action.amountIn",
      "Amount in",
      intent.amountIn === action.amountIn,
      intent.amountIn,
      action.amountIn,
    );
    check(
      "action.slippage",
      "Slippage",
      action.slippageBps <= intent.maxSlippageBps,
      intent.maxSlippageBps,
      action.slippageBps,
    );
  }
}

function verifyOutcome(
  intent: ConfirmedIntent,
  action: ProposedAction["action"],
  receipt: Receipt,
  account: string,
  check: Check,
) {
  const outcome = receipt.outcome as Record<string, JsonSafeValue>;
  check(
    "outcome.operation",
    "Outcome operation",
    outcome.operation === (intent.operation === "approval" ? "approve" : intent.operation),
    intent.operation,
    outcome.operation,
  );
  if (intent.operation === "transfer" && action.operation === "transfer") {
    const decimals = intent.asset.decimals;
    check(
      "outcome.from",
      "Outcome sender",
      typeof outcome.from === "string" && eq(outcome.from, account),
      account,
      outcome.from,
    );
    check(
      "outcome.to",
      "Outcome recipient",
      typeof outcome.to === "string" && eq(outcome.to, intent.recipient.address),
      intent.recipient.address,
      outcome.to,
    );
    check(
      "outcome.amount",
      "Outcome amount",
      outcome.amount === parseUnits(intent.amount, decimals).toString(),
      parseUnits(intent.amount, decimals),
      outcome.amount,
    );
  }
  if (intent.operation === "approval") {
    const max = parseUnits(intent.maxAmountDisplay, intent.token.decimals);
    check(
      "outcome.owner",
      "Outcome owner",
      typeof outcome.owner === "string" && eq(outcome.owner, account),
      account,
      outcome.owner,
    );
    check(
      "outcome.spender",
      "Outcome spender",
      typeof outcome.spender === "string" && eq(outcome.spender, intent.spender.address),
      intent.spender.address,
      outcome.spender,
    );
    check(
      "outcome.approval",
      "Outcome approval",
      typeof outcome.amount === "string" && BigInt(outcome.amount) <= max,
      max,
      outcome.amount,
    );
  }
  if (intent.operation === "swap") {
    check(
      "outcome.protocol",
      "Outcome protocol",
      outcome.protocol === "kuru",
      "kuru",
      outcome.protocol,
    );
    check(
      "outcome.sender",
      "Outcome sender",
      typeof outcome.sender === "string" && eq(outcome.sender, account),
      account,
      outcome.sender,
    );
    check(
      "outcome.tokenIn",
      "Outcome token in",
      typeof outcome.tokenIn === "string" && eq(outcome.tokenIn, intent.tokenIn.token),
      intent.tokenIn.token,
      outcome.tokenIn,
    );
    check(
      "outcome.tokenOut",
      "Outcome token out",
      typeof outcome.tokenOut === "string" && eq(outcome.tokenOut, intent.tokenOut.token),
      intent.tokenOut.token,
      outcome.tokenOut,
    );
    check(
      "outcome.amountIn",
      "Outcome amount in",
      outcome.amountIn === parseUnits(intent.amountIn, intent.tokenIn.decimals).toString(),
      parseUnits(intent.amountIn, intent.tokenIn.decimals),
      outcome.amountIn,
    );
    check(
      "outcome.amountOut",
      "Outcome amount out",
      typeof outcome.amountOut === "string" && BigInt(outcome.amountOut) > 0n,
      "> 0",
      outcome.amountOut,
    );
  }
}

function collectUnknownUserEffects(receipts: Receipt[], account: string) {
  const unknown: string[] = [];
  const visit = (receipt: Receipt) => {
    for (const item of receipt.changes) {
      if (item.kind === "receipt") visit(item);
      else if (
        item.change.kind === "nativeTransfer" &&
        (eq(item.change.from, account) || eq(item.change.to, account))
      )
        continue;
      else if (item.change.kind === "event" && !item.data) unknown.push(item.change.address);
    }
  };
  receipts.forEach(visit);
  return unknown;
}
