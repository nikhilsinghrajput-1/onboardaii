import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "@/components/landing/LandingPage";

const TITLE = "Keystone · Onboarding operations for Acropolis";
const DESCRIPTION =
  "Keystone provisions, tracks and approves every onboarding step across Slack, Gmail, Calendar, Drive, Sheets, Notion and Teams — with AI briefings and human approvals.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});
