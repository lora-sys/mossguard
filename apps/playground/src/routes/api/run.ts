import { createFileRoute } from "@tanstack/react-router";
import { getAgentRun } from "../../server/agent/run-store";

export const Route = createFileRoute("/api/run")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const runId = new URL(request.url).searchParams.get("runId");
        if (!runId) return Response.json({ error: "runId is required" }, { status: 400 });
        const run = await getAgentRun(runId);
        if (run) {
          const result = run.result as
            | { gate?: { status: string; envelope?: { expiresAt?: number } } }
            | undefined;
          const expired =
            result?.gate?.status === "eligible-for-wallet-review" &&
            (result.gate.envelope?.expiresAt ?? 0) <= Date.now();
          return Response.json(
            expired && result
              ? { ...run, result: { ...result, gate: { status: "withheld" } } }
              : run,
          );
        }
        return Response.json({ error: "Agent run not found" }, { status: 404 });
      },
    },
  },
});
