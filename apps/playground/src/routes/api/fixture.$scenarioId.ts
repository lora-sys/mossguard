import { createFileRoute } from "@tanstack/react-router";
import { actionFromIntent, injectScenario, scenarios } from "../../server/scenarios";
import type { ScenarioId, VerificationCheck } from "../../types/domain";

export const Route = createFileRoute("/api/fixture/$scenarioId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!(params.scenarioId in scenarios)) {
          return Response.json({ error: "Unknown fixture" }, { status: 404 });
        }
        const id = params.scenarioId as ScenarioId;
        const scenario = scenarios[id];
        const operation = scenario.intent.operation;
        const injected = injectScenario(id, actionFromIntent(scenario.intent));
        const violations: VerificationCheck[] =
          id === "transfer-drift"
            ? [
                {
                  id: "fixture.recipient",
                  field: "Recipient",
                  status: "failed",
                  expected: "Alice",
                  actual: "Bob",
                  message: "Recipient differs",
                },
                {
                  id: "fixture.amount",
                  field: "Amount",
                  status: "failed",
                  expected: "5 MON",
                  actual: "50 MON",
                  message: "Amount exceeds confirmation",
                },
              ]
            : id === "unlimited-approval"
              ? [
                  {
                    id: "fixture.approval",
                    field: "Approval amount",
                    status: "failed",
                    expected: "≤ 10 USDC",
                    actual: "MAX_UINT256",
                    message: "Unlimited approval was not authorized",
                  },
                ]
              : [];
        const decision = violations.length ? "blocked" : "verified";
        return Response.json({
          fixture: true,
          label: "FIXTURE REPLAY — NOT LIVE CHAIN STATE",
          proposedAction: {
            actionId: `fixture-${id}`,
            actionHash: "fixture-replay-not-a-security-hash",
            status: "proposed",
            action: injected.action,
            provenance: {
              source: injected.fields.length ? "scenario-injection" : "live-ai",
              provider: "fixture",
              model: "recorded-evidence",
              messageId: "fixture",
              toolCallId: "fixture",
              createdAt: "recorded fixture",
              injectedFields: injected.fields,
            },
          },
          injection: injected.fields,
          stages: ["discover", "load", "action", "simulate", "normalize"].map((stage) => ({
            stage,
            status: "completed",
            summary: "Recorded fixture — not live chain state",
          })),
          simulation: {
            results: [
              {
                protocol: operation === "swap" ? "kuru" : "erc20",
                method: operation === "approval" ? "approve" : operation,
                gas: null,
                receipt: {
                  outcome: { fixture: true, note: "Recorded structured outcome" },
                  text: "Fixture replay only",
                },
              },
            ],
          },
          report: {
            reportId: `fixture-${id}`,
            decision,
            intentId: "fixture",
            intentHash: "fixture",
            actionId: `fixture-${id}`,
            actionHash: "fixture",
            chainId: 143,
            executionAccount: "0xcccccccccccccccccccccccccccccccccccccccc",
            checks: violations,
            violations,
            unavailableReasons: [],
            evidenceSummary: {
              transactionCount: 1,
              receiptCount: 1,
              warningCount: 0,
              protocols: [operation === "swap" ? "kuru" : "erc20"],
            },
            generatedAt: "recorded fixture",
            verifier: {
              name: "MossGuard",
              version: "0.1.0",
              mossRepository: "nishuzumi/moss",
              mossCommit: "fixture",
            },
          },
          gate:
            decision === "verified"
              ? { status: "eligible-for-wallet-review", fixture: true, transactions: [] }
              : { status: "withheld" },
        });
      },
    },
  },
});
