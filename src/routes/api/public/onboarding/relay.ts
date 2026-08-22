import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/onboarding/relay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleOnboardRelay } = await import("@/lib/onboard-relay.server");
        return handleOnboardRelay(request);
      },
      GET: async () => {
        const { onboardRelayDiagnostics } = await import("@/lib/onboard-relay.server");
        return onboardRelayDiagnostics();
      },
    },
  },
});
