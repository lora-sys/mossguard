import type { ConfirmedIntent, ProposedAction, ScenarioId } from "../../types/domain";
import { digest } from "../crypto";
import { putEvidence } from "../evidence/cache";
import { validateConfirmation } from "../intent/service";
import { type MossStage, runMossPipeline } from "../moss/pipeline";
import { injectScenario } from "../scenarios";
import { createWalletReview } from "../signer/gate";
import { verifyExecution } from "../verification/verify";

type ExecutionInput = {
  confirmedIntent: ConfirmedIntent;
  confirmationToken: string;
  proposedAction: ProposedAction;
  executionAccount: `0x${string}`;
  scenarioId?: ScenarioId;
};

export async function executeGuarded(
  body: ExecutionInput,
  onMossStage?: (stage: MossStage) => void,
) {
  validateConfirmation(
    body.confirmedIntent,
    body.confirmationToken,
    process.env.INTENT_SIGNING_SECRET ?? "",
  );
  if (body.proposedAction.actionHash !== digest(body.proposedAction.action))
    throw new Error("Action hash mismatch");
  const injection = body.scenarioId
    ? injectScenario(body.scenarioId, body.proposedAction.action)
    : { action: body.proposedAction.action, fields: [] as string[] };
  const proposedAction = injection.fields.length
    ? {
        ...body.proposedAction,
        action: injection.action,
        actionHash: digest(injection.action),
        provenance: {
          ...body.proposedAction.provenance,
          source: "scenario-injection" as const,
          injectedFields: injection.fields,
        },
      }
    : body.proposedAction;
  const evidence = await runMossPipeline(proposedAction.action, onMossStage);
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
  return {
    proposedAction,
    injection: injection.fields,
    capability: evidence.capability,
    simulation: evidence.simulation,
    discovered: evidence.discovered,
    loaded: evidence.loaded,
    stages: evidence.stages,
    report,
    gate,
  };
}
