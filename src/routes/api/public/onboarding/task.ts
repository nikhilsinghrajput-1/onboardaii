import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/onboarding/task")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleTaskWebhook } = await import("@/lib/onboarding-webhooks.server");
        return handleTaskWebhook(request);
      },
    },
  },
});
