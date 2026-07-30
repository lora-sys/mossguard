import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { z } from "zod";

export function getLanguageModel(): { model: LanguageModel; provider: string; modelId: string } {
  const baseURL = process.env.OPENAI_BASE_URL ?? process.env.OPEN_BASE_URL;
  const provider =
    process.env.AI_PROVIDER ?? (baseURL?.includes("stepfun.com") ? "stepfun" : "openai");
  if (provider !== "openai" && provider !== "stepfun") {
    throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    ...(baseURL ? { baseURL } : {}),
  });
  const modelId = process.env.AI_MODEL ?? process.env.OPENAI_MODEL_ID ?? "gpt-5-mini";
  return {
    model: openai(modelId),
    provider,
    modelId,
  };
}

const compatibleToolArguments = z.object({
  proposalJson: z.string(),
  responseText: z.string().max(500).optional(),
  planSteps: z.array(z.string().max(160)).min(2).max(4).optional(),
});

export async function callOpenAICompatibleTool(input: {
  system: string;
  prompt: string;
  toolName: "propose_intent" | "propose_agent_action";
}) {
  const baseURL = process.env.OPENAI_BASE_URL ?? process.env.OPEN_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL ?? process.env.OPENAI_MODEL_ID;
  if (!baseURL || !apiKey || !model) throw new Error("OpenAI-compatible provider is incomplete");
  const request = () =>
    fetch(`${baseURL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: input.toolName,
              description: "Return the requested MossGuard proposal for deterministic validation.",
              parameters: {
                type: "object",
                properties: {
                  proposalJson: { type: "string" },
                  responseText: {
                    type: "string",
                    description:
                      "A concise user-facing explanation of what was proposed. No hidden reasoning.",
                  },
                  planSteps: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 2,
                    maxItems: 4,
                    description:
                      "A brief public execution plan. Do not reveal private chain-of-thought.",
                  },
                },
                required: ["proposalJson", "responseText", "planSteps"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: input.toolName } },
        temperature: 0,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 90_000)),
    });
  const maxAttempts = Math.max(1, Number(process.env.AI_REQUEST_ATTEMPTS ?? 3));
  let response: Response | undefined;
  let lastError: unknown;
  let attempts = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt;
    try {
      response = await request();
      if (
        response.ok ||
        (response.status !== 408 && response.status !== 429 && response.status < 500)
      )
        break;
      lastError = new Error(`Provider request failed (${response.status})`);
    } catch (error) {
      lastError = error;
      response = undefined;
    }
    if (attempt < maxAttempts)
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
  }
  if (!response) {
    const detail = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Provider request failed after ${attempts} attempts: ${detail}`);
  }
  if (!response.ok) {
    const body = await response.text();
    let detail = body;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
      detail = parsed.error?.message ?? parsed.message ?? body;
    } catch {
      // Some OpenAI-compatible providers return a plain-text error body.
    }
    const safeDetail = detail.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 300);
    throw new Error(
      `Provider request failed (${response.status})${safeDetail ? `: ${safeDetail}` : ""}`,
    );
  }
  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
      };
    }>;
  };
  const call = payload.choices?.[0]?.message?.tool_calls?.[0];
  if (call?.function?.name !== input.toolName || !call.function.arguments) {
    throw new Error(`Provider did not call ${input.toolName}`);
  }
  return {
    ...compatibleToolArguments.parse(JSON.parse(call.function.arguments)),
    toolCallId: call.id,
    attempts,
  };
}
