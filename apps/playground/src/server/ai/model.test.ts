import { afterEach, describe, expect, it } from "vitest";
import { getLanguageModel } from "./model";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
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
});
