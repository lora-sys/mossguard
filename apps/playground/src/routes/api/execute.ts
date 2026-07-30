import { createFileRoute } from "@tanstack/react-router";
import { digest } from "../../server/crypto";
import { putEvidence } from "../../server/evidence/cache";
import { validateConfirmation } from "../../server/intent/service";
import { runMossPipeline } from "../../server/moss/pipeline";
import { injectScenario } from "../../server/scenarios";
import { createWalletReview } from "../../server/signer/gate";
import { verifyExecution } from "../../server/verification/verify";
import type { ScenarioId } from "../../types/domain";

export const Route = createFileRoute("/api/execute")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          validateConfirmation(
            body.confirmedIntent,
            body.confirmationToken,
            process.env.INTENT_SIGNING_SECRET ?? "",
          );
          if (body.proposedAction.actionHash !== digest(body.proposedAction.action))
            throw new Error("Action hash mismatch");
          const injection = body.scenarioId
            ? injectScenario(body.scenarioId as ScenarioId, body.proposedAction.action)
            : { action: body.proposedAction.action, fields: [] as string[] };
          const proposedAction = injection.fields.length
            ? {
                ...body.proposedAction,
                action: injection.action,
                actionHash: digest(injection.action),
                provenance: {
                  ...body.proposedAction.provenance,
                  source: "scenario-injection",
                  injectedFields: injection.fields,
                },
              }
            : body.proposedAction;
          const evidence = await runMossPipeline(proposedAction.action);
          const report = verifyExecution({
            intent: body.confirmedIntent,
            action: proposedAction,
            capability: evidence.capability,
            simulation: evidence.simulation,
            executionAccount: body.executionAccount,
            mossCommit: "2e7c1dbeb5e6f3b1492455034e3b0348a3c0094d",
          });
          putEvidence(report.reportId, evidence);
          const gate = createWalletReview(
            report,
            evidence.capability,
            evidence.simulation,
            process.env.WALLET_HANDOFF_SECRET ?? "",
          );
          return Response.json({
            proposedAction,
            injection: injection.fields,
            capability: evidence.capability,
            simulation: evidence.simulation,
            stages: evidence.stages,
            report,
            gate,
          });
        } catch (error) {
          return Response.json(
            {
              error: "Live Moss simulation did not complete. No mock result was substituted.",
              detail: error instanceof Error ? error.message : String(error),
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
