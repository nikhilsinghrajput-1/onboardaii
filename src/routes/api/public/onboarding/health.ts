import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/onboarding/health")({
  server: {
    handlers: {
      GET: async () => {
        const { relaySecretConfigured } = await import("@/lib/relay.server");
        return Response.json({
          ok: true,
          service: "onboarding-callback-relay",
          secret_configured: relaySecretConfigured(),
          time: new Date().toISOString(),
        });
      },
    },
  },
});
