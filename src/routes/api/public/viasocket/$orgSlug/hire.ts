import { createFileRoute } from "@tanstack/react-router";

// Legacy path kept working: this workspace is single-tenant, so the slug is ignored.
export const Route = createFileRoute("/api/public/viasocket/$orgSlug/hire")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleHireWebhook } = await import("@/lib/onboarding-webhooks.server");
        return handleHireWebhook(request);
      },
    },
  },
});
