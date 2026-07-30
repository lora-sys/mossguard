import { createFileRoute } from "@tanstack/react-router";
import { publicPlan } from "../../server/ai/public-plan";

const encoder = new TextEncoder();

function event(type: string, data: unknown) {
  return encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

export const Route = createFileRoute("/api/propose-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const abort = new AbortController();
        const payload = JSON.parse(body);
        const phase = payload.phase === "intent" ? "intent" : "action";
        const locale = payload.responseLocale === "en" ? "en" : "zh";
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              event("activity", {
                id: "reasoning",
                stage: phase === "intent" ? "understand" : "prepare",
                status: "running",
                text:
                  phase === "intent" ? "正在理解你的链上请求" : "正在基于已确认意图准备独立操作",
              }),
            );
            const progressTimer = setTimeout(() => {
              controller.enqueue(
                event("activity", {
                  id: "tool",
                  stage: "tool",
                  status: "running",
                  tool: phase === "intent" ? "propose_intent" : "propose_agent_action",
                  text:
                    phase === "intent"
                      ? "正在调用 propose_intent 生成结构化草案"
                      : "正在调用 propose_agent_action 生成具体操作",
                }),
              );
            }, 350);
            void fetch(new URL("/api/propose", request.url), {
              method: "POST",
              headers: { "content-type": "application/json" },
              body,
              signal: abort.signal,
            })
              .then(async (response) => {
                clearTimeout(progressTimer);
                const result = await response.json();
                if (!response.ok) throw new Error(result.detail ?? result.error);
                controller.enqueue(
                  event("activity", {
                    id: "reasoning",
                    stage: phase === "intent" ? "understand" : "prepare",
                    status: "complete",
                    text:
                      phase === "intent"
                        ? "已理解并结构化用户授权边界"
                        : "已根据确认意图生成独立操作提案",
                  }),
                );
                controller.enqueue(
                  event("activity", {
                    id: "tool",
                    stage: "tool",
                    status: "complete",
                    tool: phase === "intent" ? "propose_intent" : "propose_agent_action",
                    text:
                      phase === "intent"
                        ? "propose_intent 返回结构化 Intent"
                        : "propose_agent_action 返回未签名操作",
                    detail: [
                      result.provider,
                      result.model,
                      result.toolCallId,
                      result.attempts > 1 ? `${result.attempts} attempts` : undefined,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  }),
                );
                const reply =
                  result.responseText ??
                  (phase === "intent"
                    ? "我已生成结构化意图草案，请确认授权边界。"
                    : "我已提出具体操作，接下来交由 MossGuard 核验。");
                controller.enqueue(
                  event("plan", { steps: publicPlan(phase, result.planSteps, locale) }),
                );
                for (const character of reply) {
                  controller.enqueue(event("delta", { text: character }));
                  await new Promise((resolve) => setTimeout(resolve, 12));
                }
                controller.enqueue(event("result", result));
                controller.close();
              })
              .catch((error) => {
                clearTimeout(progressTimer);
                if (abort.signal.aborted) return;
                controller.enqueue(
                  event("activity", {
                    id: "tool",
                    stage: "tool",
                    status: "failed",
                    text: "实时模型工具调用失败",
                    detail: error instanceof Error ? error.message : String(error),
                  }),
                );
                controller.enqueue(
                  event("error", {
                    message: error instanceof Error ? error.message : String(error),
                  }),
                );
                controller.close();
              });
          },
          cancel() {
            abort.abort();
          },
        });
        return new Response(stream, {
          headers: {
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
            "content-type": "text/event-stream; charset=utf-8",
          },
        });
      },
    },
  },
});
