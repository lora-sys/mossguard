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

type Coordinate = { protocol: "erc20" | "kuru"; method: "approve" | "transfer" | "swap" };

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
  const session = await MossToolSession.create(action, onStage);
  await session.discover();
  await session.load();
  await session.action();
  await session.simulate();
  return session.normalize();
}

export class MossToolSession {
  readonly stages: MossStage[] = [];
  discovered?: ReturnType<Registry["discover"]>;
  loaded?: ReturnType<Registry["load"]>;
  capability?: CapabilityNode;
  simulation?: SimulateOutcome;
  private readonly coordinate: Coordinate;

  private constructor(
    private readonly proposedAction: AgentAction,
    private readonly registry: Registry,
    private readonly simulator: ReturnType<typeof createTraceSimulator>,
    private readonly onStage?: (stage: MossStage) => void,
  ) {
    this.coordinate =
      proposedAction.operation === "swap"
        ? { protocol: "kuru", method: "swap" }
        : {
            protocol: "erc20",
            method: proposedAction.operation === "approval" ? "approve" : "transfer",
          };
  }

  static async create(action: AgentAction, onStage?: (stage: MossStage) => void) {
    const { registry, simulator } = await getMoss();
    return new MossToolSession(action, registry, simulator, onStage);
  }

  private emit(
    stage: MossStage["stage"],
    status: MossStage["status"],
    summary: string,
    artifact?: Record<string, unknown>,
    error?: string,
  ) {
    const value = {
      stage,
      status,
      summary,
      timestamp: new Date().toISOString(),
      ...(artifact ? { artifact } : {}),
      ...(error ? { error } : {}),
    } satisfies MossStage;
    this.onStage?.(value);
    if (status !== "running") this.stages.push(value);
    return value;
  }

  async discover() {
    if (this.discovered) throw new Error("TOOL_PRECONDITION_FAILED: discover already completed");
    this.emit("discover", "running", "Agent called moss_discover");
    this.discovered = this.registry.discover(
      this.proposedAction.operation === "swap"
        ? { protocol: "kuru" }
        : { verb: this.proposedAction.operation === "approval" ? "approve" : "transfer" },
    );
    const artifact = { coordinate: this.coordinate, matchCount: this.discovered.length };
    this.emit(
      "discover",
      "completed",
      `Agent discovered ${this.coordinate.protocol}.${this.coordinate.method}`,
      artifact,
    );
    return artifact;
  }

  async load() {
    if (!this.discovered) throw new Error("TOOL_PRECONDITION_FAILED: discover must complete first");
    if (this.loaded) throw new Error("TOOL_PRECONDITION_FAILED: load already completed");
    this.emit("load", "running", "Agent called moss_load");
    this.loaded = this.registry.load([this.coordinate]);
    const artifact = { coordinate: this.coordinate, contractCount: this.loaded.length };
    this.emit("load", "completed", "Agent loaded the canonical Moss parameter contract", artifact);
    return artifact;
  }

  async action() {
    if (!this.loaded) throw new Error("TOOL_PRECONDITION_FAILED: load must complete first");
    if (this.capability) throw new Error("TOOL_PRECONDITION_FAILED: action already completed");
    const action = this.proposedAction;
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
    this.emit("action", "running", "Agent called moss_action to build an unsigned Capability");
    const result = await this.registry.action(
      this.coordinate.protocol,
      this.coordinate.method,
      action.operation === "approval" ? action.owner : action.sender,
      params,
    );
    if (result.kind !== "capability") throw new Error("MOSS_ACTION_FAILED: no Capability returned");
    this.capability = result;
    const artifact = {
      root: `${result.protocol}.${result.method}`,
      transactionCount: countTransactions(result),
    };
    this.emit("action", "completed", "Agent built an unsigned Moss Capability tree", artifact);
    return artifact;
  }

  async simulate() {
    if (!this.capability)
      throw new Error("TOOL_PRECONDITION_FAILED: a real Capability is required to simulate");
    if (this.simulation) throw new Error("TOOL_PRECONDITION_FAILED: simulate already completed");
    this.emit("simulate", "running", "Agent called moss_simulate against Monad mainnet");
    this.simulation = await this.simulator.simulate(this.capability);
    const artifact = {
      chainId: 143,
      transactionCount: this.simulation.results.length,
      receiptCount: this.simulation.results.filter((item) => item.receipt).length,
      warningCount: this.simulation.results.reduce((sum, item) => sum + item.warnings.length, 0),
      gas: this.simulation.results.map((item) => item.gas).filter(Boolean),
    };
    this.emit(
      "simulate",
      "completed",
      this.simulation.halted ? "Agent simulation halted" : "Agent completed live Moss simulation",
      artifact,
    );
    return artifact;
  }

  normalize(): MossEvidence {
    if (!this.discovered || !this.loaded || !this.capability || !this.simulation)
      throw new Error("EVIDENCE_INCOMPLETE: all Moss tools must complete before verification");
    this.emit("normalize", "running", "Submitting Agent-collected evidence to MossGuard");
    this.emit("normalize", "completed", "Retained raw structured evidence", {
      outcomeCount: this.simulation.results.filter((item) => item.receipt?.outcome).length,
      halted: Boolean(this.simulation.halted),
    });
    return {
      capability: this.capability,
      simulation: this.simulation,
      discovered: this.discovered,
      loaded: this.loaded,
      stages: this.stages,
    };
  }
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
