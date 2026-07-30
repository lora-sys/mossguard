import { describe, expect, it } from "vitest";
import { ALICE_ADDRESS, DEMO_ACCOUNT, scenarios } from "../scenarios";
import { confirmIntent, validateConfirmation } from "./service";

const secret = "test-secret-that-is-long-enough";

describe("intent confirmation", () => {
  it("creates a stable hash and validates the signed claims", () => {
    const result = confirmIntent(scenarios["transfer-drift"].intent, secret, 1_000);
    expect(result.confirmedIntent.operation).toBe("transfer");
    expect(
      validateConfirmation(result.confirmedIntent, result.confirmationToken, secret, 2_000)
        .intentHash,
    ).toBe(result.confirmedIntent.intentHash);
  });

  it("rejects tampering and expiry", () => {
    const result = confirmIntent(scenarios["transfer-drift"].intent, secret, 1_000);
    const tampered = { ...result.confirmedIntent, amount: "50" };
    expect(() => validateConfirmation(tampered, result.confirmationToken, secret, 2_000)).toThrow(
      "does not match",
    );
    expect(() =>
      validateConfirmation(result.confirmedIntent, result.confirmationToken, secret, 2_000_000),
    ).toThrow("expired");
  });

  it("preserves resolved demo identities", () => {
    const { confirmedIntent } = confirmIntent(scenarios["transfer-drift"].intent, secret);
    expect(confirmedIntent.operation === "transfer" && confirmedIntent.recipient.address).toBe(
      ALICE_ADDRESS,
    );
    expect(confirmedIntent.operation === "transfer" && confirmedIntent.sender?.toLowerCase()).toBe(
      DEMO_ACCOUNT,
    );
  });
});
