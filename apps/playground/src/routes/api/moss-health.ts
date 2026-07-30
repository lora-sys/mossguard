import { createFileRoute } from "@tanstack/react-router";
import { mossHealth } from "../../server/moss/pipeline";
export const Route = createFileRoute("/api/moss-health")({
  server: { handlers: { GET: async () => Response.json(await mossHealth()) } },
});
