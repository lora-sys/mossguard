import { randomUUID } from "node:crypto";
import type { CapabilityNode } from "@themoss/core";
import type { SimulateOutcome } from "@themoss/simulator";
import type { VerificationReport } from "../../types/domain";
import { digest, signClaims } from "../crypto";

export function createWalletReview(
  report: VerificationReport,
  capability: CapabilityNode,
  simulation: SimulateOutcome,
  secret: string,
) {
  if (report.decision !== "verified") return { status: "withheld" as const };
  if (secret.length < 16) throw new Error("WALLET_HANDOFF_SECRET must be at least 16 characters");
  const claims = {
    envelopeId: randomUUID(),
    intentHash: report.intentHash,
    actionHash: report.actionHash,
    capabilityDigest: digest(capability),
    simulationDigest: digest(simulation),
    executionAccount: report.executionAccount,
    chainId: 143 as const,
    expiresAt: Date.now() + 10 * 60_000,
  };
  return {
    status: "eligible-for-wallet-review" as const,
    envelope: {
      ...claims,
      signature: signClaims(claims, secret),
      transactions: simulation.results.map((result) => result.transaction),
    },
  };
}
