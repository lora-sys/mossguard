import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/wallet-handoff")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          enabled: process.env.ENABLE_WALLET_HANDOFF === "true",
          policy:
            "MossGuard never signs or sends. When enabled, only an explicit user click may open wallet review.",
        }),
    },
  },
});
