import { afterEach, describe, expect, it, vi } from "vitest";
import { callOpenAICompatibleTool, getLanguageModel } from "./model";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  vi.unstubAllGlobals();
});

describe("language model adapter", () => {
  it("recognizes the existing StepFun OpenAI-compatible aliases", () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPEN_BASE_URL = "https://api.stepfun.com/step_plan/v1";
    process.env.OPENAI_MODEL_ID = "step-3.7-flash";
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL;

    const configured = getLanguageModel();
    expect(configured.provider).toBe("stepfun");
    expect(configured.modelId).toBe("step-3.7-flash");
  });

  it("retries transient StepFun failures without substituting a mock", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPEN_BASE_URL = "https://api.stepfun.com/step_plan/v1";
    process.env.AI_MODEL = "step-3.7-flash";
    process.env.AI_REQUEST_ATTEMPTS = "3";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call-live",
                    function: {
                      name: "propose_intent",
                      arguments: JSON.stringify({
                        proposalJson: "{}",
                        responseText: "done",
                        planSteps: ["one", "two"],
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callOpenAICompatibleTool({
      system: "system",
      prompt: "prompt",
      toolName: "propose_intent",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.toolCallId).toBe("call-live");
    expect(result.attempts).toBe(2);
  });
});
