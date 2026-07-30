import type { AgentAction } from "../../types/domain";
import { type MossEvidence, type MossStage, MossToolSession } from "../moss/pipeline";
import { AGENT_PROMPT_VERSION, MOSS_TOOL_SYSTEM_PROMPT } from "./prompts";
import type { AgentToolName, AgentToolTrace } from "./types";

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type Message =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type MossAgentResult = {
  evidence: MossEvidence;
  toolCalls: AgentToolTrace[];
  attempts: number;
  tokenUsage?: { prompt: number; completion: number; total: number };
  promptVersion: string;
};

export async function runMossToolAgent(
  action: AgentAction,
  options: {
    onStage?: (stage: MossStage) => void;
    onTool?: (trace: AgentToolTrace) => void;
    signal?: AbortSignal;
  } = {},
): Promise<MossAgentResult> {
  const baseURL = process.env.OPENAI_BASE_URL ?? process.env.OPEN_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.AI_MODEL ?? process.env.OPENAI_MODEL_ID;
  if (!baseURL || !apiKey || !model)
    throw coded("PROVIDER_NOT_CONFIGURED", "AI provider is incomplete");
  const session = await MossToolSession.create(action, options.onStage);
  const messages: Message[] = [
    { role: "system", content: MOSS_TOOL_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Inspect this confirmed unsigned action. The harness owns the exact action and tool inputs: ${JSON.stringify(action)}`,
    },
  ];
  const traces: AgentToolTrace[] = [];
  let attempts = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  const maxCalls = Math.max(5, Number(process.env.MOSSGUARD_AGENT_TOOL_BUDGET ?? 8));

  for (let sequence = 1; sequence <= maxCalls; sequence += 1) {
    let response: Awaited<ReturnType<typeof requestTool>>;
    try {
      response = await requestTool({
        baseURL,
        apiKey,
        model,
        messages,
        signal: options.signal,
      });
    } catch (error) {
      throw attachRunContext(error, traces, attempts);
    }
    attempts += response.attempts;
    promptTokens += response.usage?.prompt_tokens ?? 0;
    completionTokens += response.usage?.completion_tokens ?? 0;
    const call = response.call;
    if (!isToolName(call.function.name))
      throw coded("TOOL_CALL_INVALID", `Unsupported Agent tool: ${call.function.name}`);
    const started = Date.now();
    const trace: AgentToolTrace = {
      toolCallId: call.id,
      tool: call.function.name,
      sequence,
      status: "running",
      startedAt: new Date(started).toISOString(),
    };
    traces.push(trace);
    options.onTool?.(trace);
    let artifact: Record<string, unknown>;
    try {
      JSON.parse(call.function.arguments || "{}");
      artifact = await executeTool(call.function.name, session);
      Object.assign(trace, {
        status: "completed" as const,
        completedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        artifact,
      });
      options.onTool?.({ ...trace });
    } catch (error) {
      const normalized = normalizeError(error);
      Object.assign(trace, {
        status: "failed" as const,
        completedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        errorCode: normalized.code,
        error: normalized.message,
      });
      options.onTool?.({ ...trace });
      throw attachRunContext(coded(normalized.code, normalized.message), traces, attempts);
    }
    messages.push({ role: "assistant", content: response.content, tool_calls: [call] });
    messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(artifact) });
    if (call.function.name === "submit_for_verification") {
      return {
        evidence: session.normalize(),
        toolCalls: traces,
        attempts,
        ...(promptTokens || completionTokens
          ? {
              tokenUsage: {
                prompt: promptTokens,
                completion: completionTokens,
                total: promptTokens + completionTokens,
              },
            }
          : {}),
        promptVersion: AGENT_PROMPT_VERSION,
      };
    }
  }
  throw attachRunContext(
    coded("AGENT_TOOL_BUDGET_EXHAUSTED", `Agent exceeded ${maxCalls} Moss tool calls`),
    traces,
    attempts,
  );
}

async function executeTool(name: AgentToolName, session: MossToolSession) {
  if (name === "moss_discover") return session.discover();
  if (name === "moss_load") return session.load();
  if (name === "moss_action") return session.action();
  if (name === "moss_simulate") return session.simulate();
  if (!session.simulation)
    throw coded("EVIDENCE_INCOMPLETE", "moss_simulate must complete before verification");
  return { accepted: true, verifier: "MossGuard", modelCannotOverrideDecision: true };
}

async function requestTool(input: {
  baseURL: string;
  apiKey: string;
  model: string;
  messages: Message[];
  signal?: AbortSignal;
}) {
  const maxAttempts = Math.max(1, Number(process.env.AI_REQUEST_ATTEMPTS ?? 3));
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const timeout = AbortSignal.timeout(Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 90_000));
      const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
      const response = await fetch(`${input.baseURL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: input.model,
          messages: input.messages,
          tools: toolDefinitions,
          tool_choice: "required",
          temperature: 0,
          max_tokens: 1024,
        }),
        signal,
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        if (
          (response.status === 408 || response.status === 429 || response.status >= 500) &&
          attempt < maxAttempts
        ) {
          lastError = new Error(`Provider request failed (${response.status})`);
          await delay(250 * 2 ** (attempt - 1));
          continue;
        }
        throw coded(
          "PROVIDER_REQUEST_FAILED",
          `Provider request failed (${response.status}): ${detail}`,
        );
      }
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const calls = payload.choices?.[0]?.message?.tool_calls;
      const call = calls?.[0];
      if (!call || calls?.length !== 1)
        throw coded("TOOL_CALL_MISSING", "Agent must call exactly one Moss tool per turn");
      return {
        call,
        content: payload.choices?.[0]?.message?.content ?? null,
        usage: payload.usage,
        attempts: attempt,
      };
    } catch (error) {
      if ((error as { code?: string }).code) throw error;
      lastError = error;
      if (attempt < maxAttempts) {
        await delay(250 * 2 ** (attempt - 1));
      }
    }
  }
  const normalized = normalizeError(lastError);
  throw coded("PROVIDER_REQUEST_FAILED", normalized.message);
}

const toolDefinitions = [
  definition(
    "moss_discover",
    "Search the real Moss Registry for the capability matching this action. Call first.",
  ),
  definition("moss_load", "Load the canonical Moss parameter contract after discovery."),
  definition(
    "moss_action",
    "Build the unsigned Moss Capability tree after loading. Never signs or broadcasts.",
  ),
  definition(
    "moss_simulate",
    "Simulate the built Capability against live Monad mainnet and return Receipt evidence.",
  ),
  definition(
    "submit_for_verification",
    "Submit accumulated real evidence to deterministic MossGuard. Call only after simulation.",
  ),
] as const;

function definition(name: AgentToolName, description: string) {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  };
}

function isToolName(value: string): value is AgentToolName {
  return toolDefinitions.some((item) => item.function.name === value);
}

function coded(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

function normalizeError(error: unknown) {
  return {
    code: (error as { code?: string })?.code ?? "AGENT_TOOL_FAILED",
    message: error instanceof Error ? error.message : String(error),
  };
}

function attachRunContext(error: unknown, toolCalls: AgentToolTrace[], attempts: number) {
  const normalized = normalizeError(error);
  return Object.assign(coded(normalized.code, normalized.message), {
    toolCalls: toolCalls.map((trace) => ({ ...trace })),
    attempts,
  });
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
