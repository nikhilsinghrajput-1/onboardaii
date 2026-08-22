import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/onboarding/hire")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleHireWebhook } = await import("@/lib/onboarding-webhooks.server");
        return handleHireWebhook(request);
      },
    },
  },
});
