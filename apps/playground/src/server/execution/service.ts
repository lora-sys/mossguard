import type { ConfirmedIntent, ProposedAction, ScenarioId } from "../../types/domain";
import { runMossToolAgent } from "../agent/moss-tool-agent";
import { AGENT_PROMPT_VERSION } from "../agent/prompts";
import { putAgentRun } from "../agent/run-store";
import type { AgentRun, AgentToolTrace } from "../agent/types";
import { digest } from "../crypto";
import { putEvidence } from "../evidence/cache";
import { validateConfirmation } from "../intent/service";
import type { MossStage } from "../moss/pipeline";
import { injectScenario } from "../scenarios";
import { getServerSecret } from "../secrets";
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
  onAgentTool?: (trace: AgentToolTrace) => void,
) {
  validateConfirmation(
    body.confirmedIntent,
    body.confirmationToken,
    getServerSecret("INTENT_SIGNING_SECRET"),
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
  const started = Date.now();
  const runId = crypto.randomUUID();
  const configuredProvider =
    process.env.AI_PROVIDER ??
    ((process.env.OPENAI_BASE_URL ?? process.env.OPEN_BASE_URL)?.includes("stepfun.com")
      ? "stepfun"
      : "openai");
  const initialRun: AgentRun = {
    runId,
    createdAt: new Date(started).toISOString(),
    updatedAt: new Date(started).toISOString(),
    inputHash: digest({
      intentHash: body.confirmedIntent.intentHash,
      action: proposedAction.action,
    }),
    promptVersion: AGENT_PROMPT_VERSION,
    provider: configuredProvider,
    model: process.env.AI_MODEL ?? process.env.OPENAI_MODEL_ID ?? "unknown",
    status: "running",
    toolCalls: [],
    attempts: 0,
  };
  await putAgentRun(initialRun);
  let agentResult: Awaited<ReturnType<typeof runMossToolAgent>>;
  try {
    agentResult = await runMossToolAgent(proposedAction.action, {
      onStage: onMossStage,
      onTool: onAgentTool,
    });
  } catch (error) {
    const code = (error as { code?: string }).code ?? "AGENT_RUN_FAILED";
    const failedContext = error as { toolCalls?: AgentToolTrace[]; attempts?: number };
    await putAgentRun({
      ...initialRun,
      updatedAt: new Date().toISOString(),
      status: "failed",
      toolCalls: failedContext.toolCalls ?? [],
      attempts: failedContext.attempts ?? 0,
      latencyMs: Date.now() - started,
      stopReason: code === "AGENT_TOOL_BUDGET_EXHAUSTED" ? "budget_exhausted" : "unavailable",
      errorCode: code,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  const evidence = agentResult.evidence;
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
    getServerSecret("WALLET_HANDOFF_SECRET"),
  );
  const result = {
    confirmedIntent: body.confirmedIntent,
    proposedAction,
    injection: injection.fields,
    capability: evidence.capability,
    simulation: evidence.simulation,
    discovered: evidence.discovered,
    loaded: evidence.loaded,
    stages: evidence.stages,
    report,
    gate,
    runId,
    agentRun: {
      promptVersion: agentResult.promptVersion,
      toolCalls: agentResult.toolCalls,
      attempts: agentResult.attempts,
      tokenUsage: agentResult.tokenUsage,
      latencyMs: Date.now() - started,
      stopReason: report.decision === "verified" ? "completed" : report.decision,
    },
  };
  await putAgentRun({
    ...initialRun,
    updatedAt: new Date().toISOString(),
    status: "completed",
    toolCalls: agentResult.toolCalls,
    attempts: agentResult.attempts,
    ...(agentResult.tokenUsage ? { tokenUsage: agentResult.tokenUsage } : {}),
    latencyMs: Date.now() - started,
    stopReason: report.decision === "verified" ? "completed" : report.decision,
    reportId: report.reportId,
    decision: report.decision,
    result,
  });
  return result;
}
