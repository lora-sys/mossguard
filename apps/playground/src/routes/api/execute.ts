import { createFileRoute } from "@tanstack/react-router";
import { executeGuarded } from "../../server/execution/service";

export const Route = createFileRoute("/api/execute")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return Response.json(await executeGuarded(await request.json()));
        } catch (error) {
          return Response.json(
            {
              error: "Live Moss simulation did not complete. No mock result was substituted.",
              detail: error instanceof Error ? error.message : String(error),
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
