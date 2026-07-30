import { createFileRoute } from "@tanstack/react-router";
import { executeGuarded } from "../../server/execution/service";

const encoder = new TextEncoder();
const event = (type: string, data: unknown) =>
  encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);

export const Route = createFileRoute("/api/execute-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();
        const stream = new ReadableStream({
          start(controller) {
            let activeStage = "discover";
            void executeGuarded(body, (stage) => {
              if (stage.status === "running") activeStage = stage.stage;
              controller.enqueue(event("moss-stage", stage));
            })
              .then((result) => {
                controller.enqueue(event("result", result));
                controller.close();
              })
              .catch((error) => {
                controller.enqueue(
                  event("moss-stage", {
                    stage: activeStage,
                    status: "failed",
                    summary: "Moss pipeline failed closed",
                    timestamp: new Date().toISOString(),
                    error: error instanceof Error ? error.message : String(error),
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
