import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Acropolis Onboarding · new hire provisioning status" },
      {
        name: "description",
        content:
          "Live dashboard for new hire provisioning: per-task status, approval queue for sensitive actions, and failure alerts.",
      },
      { property: "og:title", content: "Acropolis Onboarding" },
      {
        property: "og:description",
        content: "Live new hire provisioning status, approvals, and failure alerts in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
