import { createFileRoute } from "@tanstack/react-router";
import { confirmIntent } from "../../server/intent/service";
import { getServerSecret } from "../../server/secrets";

export const Route = createFileRoute("/api/confirm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return Response.json(
            confirmIntent(await request.json(), getServerSecret("INTENT_SIGNING_SECRET")),
          );
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 400 },
          );
        }
      },
    },
  },
});
