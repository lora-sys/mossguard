import { beforeEach, describe, expect, it, vi } from "vitest";

const { runMossPipeline } = vi.hoisted(() => ({ runMossPipeline: vi.fn() }));
vi.mock("../crypto", () => ({ digest: () => "action-hash" }));
vi.mock("../intent/service", () => ({ validateConfirmation: vi.fn() }));
vi.mock("../evidence/cache", () => ({ putEvidence: vi.fn() }));
vi.mock("../moss/pipeline", () => ({ runMossPipeline }));
vi.mock("../scenarios", () => ({
  injectScenario: (_id: string, action: unknown) => ({ action, fields: [] }),
}));
vi.mock("../verification/verify", () => ({
  verifyExecution: () => ({ reportId: "report", decision: "verified", checks: [] }),
}));
vi.mock("../signer/gate", () => ({
  createWalletReview: () => ({ status: "eligible-for-wallet-review" }),
}));

import { executeGuarded } from "./service";

describe("guarded execution service", () => {
  beforeEach(() => runMossPipeline.mockReset());

  it("preserves discover/load artifacts and forwards real Moss stages in order", async () => {
    const stages = ["discover", "load", "action", "simulate", "normalize"] as const;
    runMossPipeline.mockResolvedValue({
      capability: { kind: "capability", children: [] },
      simulation: { results: [] },
      discovered: [{ protocol: "erc20", method: "approve" }],
      loaded: [{ protocol: "erc20", method: "approve", risks: ["approval"] }],
      stages: stages.map((stage) => ({
        stage,
        status: "completed",
        summary: stage,
        timestamp: "2026-07-29T00:00:00.000Z",
      })),
    });
    const observed: string[] = [];
    const result = await executeGuarded(
      {
        confirmedIntent: {} as never,
        confirmationToken: "confirmation",
        executionAccount: "0xcccccccccccccccccccccccccccccccccccccccc",
        proposedAction: {
          actionId: "action",
          actionHash: "action-hash",
          status: "proposed",
          action: {} as never,
          provenance: {} as never,
        },
      },
      (stage) => observed.push(stage.stage),
    );

    const observer = runMossPipeline.mock.calls[0]?.[1];
    expect(observer).toBeTypeOf("function");
    for (const stage of stages)
      observer({
        stage,
        status: "completed",
        summary: stage,
        timestamp: "2026-07-29T00:00:00.000Z",
      });
    expect(observed).toEqual(stages);
    expect(result.discovered).toEqual([{ protocol: "erc20", method: "approve" }]);
    expect(result.loaded).toEqual([{ protocol: "erc20", method: "approve", risks: ["approval"] }]);
    expect(result.gate.status).toBe("eligible-for-wallet-review");
  });
});
