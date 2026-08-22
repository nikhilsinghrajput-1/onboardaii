import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/onboarding/task-update")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleRelayRequest } = await import("@/lib/relay.server");
        return handleRelayRequest(request, "task-update");
      },
    },
  },
});
