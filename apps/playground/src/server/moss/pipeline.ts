import { type CapabilityNode, NATIVE, Registry } from "@themoss/core";
import * as erc from "@themoss/erc";
import * as kuru from "@themoss/protocol-kuru";
import { createTraceSimulator, type SimulateOutcome } from "@themoss/simulator";
import * as system from "@themoss/system";
import { monadRuntime, USDC_ADDRESS } from "@themoss/system";
import type { AgentAction } from "../../types/domain";

export type MossStage = {
  stage: "discover" | "load" | "action" | "simulate" | "normalize";
  status: "completed";
  summary: string;
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

export async function runMossPipeline(action: AgentAction): Promise<MossEvidence> {
  const { registry, simulator } = await getMoss();
  const coordinate =
    action.operation === "swap"
      ? { protocol: "kuru", method: "swap" }
      : { protocol: "erc20", method: action.operation === "approval" ? "approve" : "transfer" };
  const discovered = registry.discover(
    action.operation === "swap"
      ? { protocol: "kuru" }
      : { verb: action.operation === "approval" ? "approve" : "transfer" },
  );
  const loaded = registry.load([coordinate]);
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
  const result = await registry.action(
    coordinate.protocol,
    coordinate.method,
    action.operation === "approval" ? action.owner : action.sender,
    params,
  );
  if (result.kind !== "capability") throw new Error("Moss action did not return a Capability");
  const simulation = await simulator.simulate(result);
  return {
    capability: result,
    simulation,
    discovered,
    loaded,
    stages: [
      {
        stage: "discover",
        status: "completed",
        summary: `Found ${coordinate.protocol}.${coordinate.method}`,
      },
      { stage: "load", status: "completed", summary: "Loaded canonical parameter contract" },
      { stage: "action", status: "completed", summary: "Built unsigned Capability tree" },
      {
        stage: "simulate",
        status: "completed",
        summary: simulation.halted ? "Simulation halted" : "Simulated against Monad mainnet",
      },
      { stage: "normalize", status: "completed", summary: "Retained raw structured evidence" },
    ],
  };
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
