import { type CapabilityNode, NATIVE, Registry } from "@themoss/core";
import * as erc from "@themoss/erc";
import * as kuru from "@themoss/protocol-kuru";
import { createTraceSimulator, type SimulateOutcome } from "@themoss/simulator";
import * as system from "@themoss/system";
import { monadRuntime, USDC_ADDRESS } from "@themoss/system";
import type { AgentAction } from "../../types/domain";

export type MossStage = {
  stage: "discover" | "load" | "action" | "simulate" | "normalize";
  status: "running" | "completed" | "failed";
  summary: string;
  timestamp: string;
  artifact?: Record<string, unknown>;
  error?: string;
};
export type MossEvidence = {
  capability: CapabilityNode;
  simulation: SimulateOutcome;
  stages: MossStage[];
  discovered: unknown;
  loaded: unknown;
};

let composition: ReturnType<typeof createComposition> | undefined;
async function createComposition() {
  const runtime = await monadRuntime({
    ...(process.env.MOSS_RPC_URL ? { rpcUrl: process.env.MOSS_RPC_URL } : {}),
  });
  const registry = new Registry(runtime, {
    trustedTokens: [{ address: USDC_ADDRESS, label: "USDC" }],
  }).use(system, erc, kuru);
  const simulator = createTraceSimulator(runtime, {
    receipt: (capability, changes) => registry.parseReceipt(capability, changes),
  });
  return { registry, simulator };
}

export async function getMoss() {
  composition ??= createComposition();
  try {
    return await composition;
  } catch (error) {
    composition = undefined;
    throw error;
  }
}

export async function runMossPipeline(
  action: AgentAction,
  onStage?: (stage: MossStage) => void,
): Promise<MossEvidence> {
  const { registry, simulator } = await getMoss();
  const stages: MossStage[] = [];
  const emit = (
    stage: MossStage["stage"],
    status: MossStage["status"],
    summary: string,
    artifact?: Record<string, unknown>,
    error?: string,
  ) => {
    const event = {
      stage,
      status,
      summary,
      timestamp: new Date().toISOString(),
      ...(artifact ? { artifact } : {}),
      ...(error ? { error } : {}),
    } satisfies MossStage;
    onStage?.(event);
    if (status !== "running") stages.push(event);
  };
  const coordinate =
    action.operation === "swap"
      ? { protocol: "kuru", method: "swap" }
      : { protocol: "erc20", method: action.operation === "approval" ? "approve" : "transfer" };
  emit("discover", "running", "Searching the Moss capability registry");
  const discovered = registry.discover(
    action.operation === "swap"
      ? { protocol: "kuru" }
      : { verb: action.operation === "approval" ? "approve" : "transfer" },
  );
  emit("discover", "completed", `Found ${coordinate.protocol}.${coordinate.method}`, {
    coordinate,
    matchCount: discovered.length,
  });
  emit("load", "running", "Loading the canonical Moss parameter contract");
  const loaded = registry.load([coordinate]);
  emit("load", "completed", "Loaded canonical parameter contract", {
    coordinate,
    contractCount: loaded.length,
  });
  const params =
    action.operation === "transfer"
      ? {
          token: action.asset.token === "native" ? NATIVE : action.asset.token,
          to: action.recipient,
          amount: action.amount,
        }
      : action.operation === "approval"
        ? { token: action.token, spender: action.spender, amount: action.amountBaseUnits }
        : {
            tokenIn: action.tokenIn === "native" ? NATIVE : action.tokenIn,
            tokenOut: action.tokenOut,
            amountIn: action.amountIn,
            slippage: action.slippageBps,
          };
  emit("action", "running", "Building an unsigned Moss Capability tree");
  const result = await registry.action(
    coordinate.protocol,
    coordinate.method,
    action.operation === "approval" ? action.owner : action.sender,
    params,
  );
  if (result.kind !== "capability") throw new Error("Moss action did not return a Capability");
  const transactionLeaves = countTransactions(result);
  emit("action", "completed", "Built unsigned Capability tree", {
    root: `${result.protocol}.${result.method}`,
    transactionCount: transactionLeaves,
  });
  emit("simulate", "running", "Simulating the Capability tree against Monad mainnet");
  const simulation = await simulator.simulate(result);
  emit(
    "simulate",
    "completed",
    simulation.halted ? "Simulation halted" : "Simulated against Monad mainnet",
    {
      chainId: 143,
      transactionCount: simulation.results.length,
      receiptCount: simulation.results.filter((item) => item.receipt).length,
      warningCount: simulation.results.reduce((sum, item) => sum + item.warnings.length, 0),
      gas: simulation.results.map((item) => item.gas).filter(Boolean),
    },
  );
  emit("normalize", "running", "Normalizing raw receipts into verifier evidence");
  emit("normalize", "completed", "Retained raw structured evidence", {
    outcomeCount: simulation.results.filter((item) => item.receipt?.outcome).length,
    halted: Boolean(simulation.halted),
  });
  return {
    capability: result,
    simulation,
    discovered,
    loaded,
    stages,
  };
}

function countTransactions(node: CapabilityNode): number {
  return node.children.reduce(
    (count, child) => count + (child.kind === "transaction" ? 1 : countTransactions(child)),
    0,
  );
}

export async function mossHealth() {
  try {
    const { registry } = await getMoss();
    return { ok: true, chainId: 143, capabilities: registry.discover({}).length };
  } catch (error) {
    return {
      ok: false,
      chainId: 143,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
