import { createFileRoute } from "@tanstack/react-router";
import { getEvidence } from "../../server/evidence/cache";
export const Route = createFileRoute("/api/raw-evidence/$reportId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const evidence = getEvidence(params.reportId);
        return evidence
          ? Response.json(evidence)
          : Response.json({ error: "Evidence expired or missing" }, { status: 404 });
      },
    },
  },
});
