import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = {
  discover: vi.fn(),
  load: vi.fn(),
  action: vi.fn(),
  simulate: vi.fn(),
  normalize: vi.fn(),
  simulation: undefined as unknown,
};

vi.mock("../moss/pipeline", () => ({
  MossToolSession: { create: vi.fn(async () => session) },
}));

import { runMossToolAgent } from "./moss-tool-agent";

const original = { ...process.env };

beforeEach(() => {
  process.env.OPEN_BASE_URL = "https://example.test/v1";
  process.env.OPENAI_API_KEY = "test-key";
  process.env.AI_MODEL = "step-test";
  session.discover.mockReset().mockResolvedValue({ matchCount: 1 });
  session.load.mockReset().mockResolvedValue({ contractCount: 1 });
  session.action.mockReset().mockResolvedValue({ transactionCount: 1 });
  session.simulate.mockReset().mockImplementation(async () => {
    session.simulation = { results: [{}] };
    return { receiptCount: 1 };
  });
  session.normalize.mockReset().mockReturnValue({
    capability: {},
    simulation: { results: [] },
    discovered: [],
    loaded: [],
    stages: [],
  });
});

afterEach(() => {
  process.env = { ...original };
  vi.unstubAllGlobals();
  session.simulation = undefined;
});

describe("Moss tool Agent", () => {
  it("executes the model-selected Moss tools in order and records auditable traces", async () => {
    const names = [
      "moss_discover",
      "moss_load",
      "moss_action",
      "moss_simulate",
      "submit_for_verification",
    ];
    const fetchMock = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: `call-${fetchMock.mock.calls.length}`,
                  type: "function",
                  function: {
                    name: names[fetchMock.mock.calls.length - 1],
                    arguments: "{}",
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 2 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const observed: string[] = [];

    const result = await runMossToolAgent({ operation: "approval" } as never, {
      onTool: (trace) => {
        if (trace.status === "completed") observed.push(trace.tool);
      },
    });

    expect(observed).toEqual(names);
    expect(result.toolCalls).toHaveLength(5);
    expect(result.tokenUsage?.total).toBe(60);
    expect(session.normalize).toHaveBeenCalledOnce();
  });

  it("fails closed when the model selects a tool before its prerequisite", async () => {
    session.load.mockRejectedValueOnce(
      Object.assign(new Error("discover must complete first"), {
        code: "TOOL_PRECONDITION_FAILED",
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call-invalid",
                    type: "function",
                    function: { name: "moss_load", arguments: "{}" },
                  },
                ],
              },
            },
          ],
        }),
      ),
    );

    await expect(runMossToolAgent({ operation: "approval" } as never)).rejects.toMatchObject({
      code: "TOOL_PRECONDITION_FAILED",
    });
    expect(session.simulate).not.toHaveBeenCalled();
  });
});
