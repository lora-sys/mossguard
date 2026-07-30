import type { CapabilityNode, JsonSafeValue, Receipt } from "@themoss/core";
import type { SimulateOutcome } from "@themoss/simulator";
import { parseUnits } from "viem";
import { describe, expect, it } from "vitest";
import { digest } from "../crypto";
import { confirmIntent } from "../intent/service";
import {
  ALICE_ADDRESS,
  actionFromIntent,
  BOB_ADDRESS,
  DEMO_ACCOUNT,
  injectScenario,
  scenarios,
} from "../scenarios";
import { verifyExecution } from "./verify";

const secret = "test-secret-that-is-long-enough";
const tx = { from: DEMO_ACCOUNT, to: ALICE_ADDRESS, data: "0x" as const, value: "0x0" as const };

function fixture(id: keyof typeof scenarios, inject = false) {
  const { confirmedIntent } = confirmIntent(scenarios[id].intent, secret);
  const base = actionFromIntent(confirmedIntent);
  const changed = inject ? injectScenario(id, base).action : base;
  const action = {
    actionId: "action",
    actionHash: digest(changed),
    status: "proposed" as const,
    action: changed,
    provenance: {
      source: inject ? ("scenario-injection" as const) : ("live-ai" as const),
      provider: "test",
      model: "test",
      messageId: "message",
      toolCallId: "tool",
      createdAt: new Date().toISOString(),
    },
  };
  const protocol = changed.operation === "swap" ? "kuru" : "erc20";
  const method = changed.operation === "approval" ? "approve" : changed.operation;
  const capability: CapabilityNode = {
    kind: "capability",
    protocol,
    method,
    params: changed,
    children: [{ kind: "transaction", transaction: tx }],
  };
  const outcome =
    changed.operation === "transfer"
      ? {
          operation: "transfer",
          token: changed.asset.token,
          from: DEMO_ACCOUNT,
          to: changed.recipient,
          amount: parseUnits(changed.amount, 18).toString(),
        }
      : changed.operation === "approval"
        ? {
            operation: "approve",
            token: changed.token,
            owner: DEMO_ACCOUNT,
            spender: changed.spender,
            amount: changed.amountBaseUnits,
          }
        : {
            operation: "swap",
            protocol: "kuru",
            sender: DEMO_ACCOUNT,
            tokenIn: changed.tokenIn,
            tokenOut: changed.tokenOut,
            amountIn: parseUnits(changed.amountIn, 18).toString(),
            amountOut: "2500000",
          };
  const safeOutcome: JsonSafeValue = JSON.parse(JSON.stringify(outcome));
  const receipt: Receipt = {
    kind: "receipt",
    protocol,
    outcome: safeOutcome,
    text: "display only",
    changes: [],
  };
  const simulation: SimulateOutcome = {
    results: [
      {
        protocol,
        method,
        transaction: tx,
        reverted: false,
        receipt,
        changes: [],
        warnings: [],
        gas: "100",
      },
    ],
  };
  return {
    intent: confirmedIntent,
    action,
    capability,
    simulation,
    executionAccount: DEMO_ACCOUNT,
    mossCommit: "test",
  };
}

describe("deterministic verification", () => {
  it("blocks recipient and amount drift", () => {
    const report = verifyExecution(fixture("transfer-drift", true));
    expect(report.decision).toBe("blocked");
    expect(report.violations.map((item) => item.field)).toEqual(
      expect.arrayContaining(["Recipient", "Amount"]),
    );
    expect(BOB_ADDRESS).not.toBe(ALICE_ADDRESS);
  });
  it("blocks unlimited approval", () =>
    expect(verifyExecution(fixture("unlimited-approval", true)).decision).toBe("blocked"));
  it("verifies a matching Kuru swap", () =>
    expect(verifyExecution(fixture("safe-kuru-swap")).decision).toBe("verified"));
  it("fails closed on warnings", () => {
    const input = fixture("safe-kuru-swap");
    input.simulation.results[0]?.warnings.push({ code: "TRACE_FAILED", message: "offline" });
    expect(verifyExecution(input).decision).toBe("unavailable");
  });
});
