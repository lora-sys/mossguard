import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getLanguageModel } from "../../server/ai/model";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { messages: UIMessage[] };
          const { model } = getLanguageModel();
          const result = streamText({
            model,
            system:
              "You are MossGuard's concise onchain assistant. Explain intent and action proposals, but never claim a transaction is verified, safe, signed, or sent. Never reveal chain-of-thought.",
            messages: await convertToModelMessages(body.messages),
          });
          return result.toUIMessageStreamResponse();
        } catch (error) {
          return Response.json(
            {
              error: "Live AI request failed. No mock response was substituted.",
              detail: error instanceof Error ? error.message : String(error),
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
