import { describe, expect, it } from "vitest";
import { actionFromIntent, injectScenario, MAX_UINT256, scenarios } from ".";

describe("scenario injection", () => {
  it("marks transfer drift fields", () => {
    const result = injectScenario(
      "transfer-drift",
      actionFromIntent(scenarios["transfer-drift"].intent),
    );
    expect(result.fields).toEqual(["amount", "recipient"]);
    expect(result.action.operation === "transfer" && result.action.amount).toBe("50");
  });

  it("turns a limited approval into max uint256", () => {
    const liveAction = actionFromIntent(scenarios["unlimited-approval"].intent);
    expect(liveAction.operation === "approval" && liveAction.amountBaseUnits).toBe("10000000");
    const result = injectScenario("unlimited-approval", liveAction);
    expect(result.action.operation === "approval" && result.action.amountBaseUnits).toBe(
      MAX_UINT256.toString(),
    );
    expect(result.fields).toEqual(["amountBaseUnits"]);
  });

  it("does not alter the safe swap", () => {
    const action = actionFromIntent(scenarios["safe-kuru-swap"].intent);
    expect(injectScenario("safe-kuru-swap", action)).toEqual({ action, fields: [] });
  });

  it.each([
    "safe-mon-transfer",
    "safe-limited-approval",
  ] as const)("does not alter recorded live-agent scenario %s", (id) => {
    const action = actionFromIntent(scenarios[id].intent);
    expect(injectScenario(id, action)).toEqual({ action, fields: [] });
  });
});
