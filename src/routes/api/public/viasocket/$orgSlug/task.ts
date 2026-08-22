import { createFileRoute } from "@tanstack/react-router";

// Legacy path kept working: this workspace is single-tenant, so the slug is ignored.
export const Route = createFileRoute("/api/public/viasocket/$orgSlug/task")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleTaskWebhook } = await import("@/lib/onboarding-webhooks.server");
        return handleTaskWebhook(request);
      },
    },
  },
});
