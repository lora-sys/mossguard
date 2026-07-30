import { createFileRoute } from "@tanstack/react-router";

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
        const phase = JSON.parse(body).phase === "intent" ? "intent" : "action";
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              event("activity", {
                stage: phase === "intent" ? "understand" : "prepare",
                text:
                  phase === "intent" ? "正在理解你的链上请求" : "正在基于已确认意图准备独立操作",
              }),
            );
            const progressTimer = setTimeout(() => {
              controller.enqueue(
                event("activity", {
                  stage: "tool",
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
                const reply =
                  result.responseText ??
                  (phase === "intent"
                    ? "我已生成结构化意图草案，请确认授权边界。"
                    : "我已提出具体操作，接下来交由 MossGuard 核验。");
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
