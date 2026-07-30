import { createFileRoute } from "@tanstack/react-router";
import { scenarios } from "../../server/scenarios";
export const Route = createFileRoute("/api/scenarios")({
  server: { handlers: { GET: async () => Response.json(scenarios) } },
});
