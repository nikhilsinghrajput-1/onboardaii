import { createFileRoute } from "@tanstack/react-router";

import { MembersCard } from "@/components/MembersCard";
import { useOrgContext } from "@/lib/org-context";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin · Acropolis Onboarding" },
      {
        name: "description",
        content:
          "Manage who can access Acropolis onboarding: invite HRs and team leads by email, promote admins, and remove people who leave.",
      },
      { property: "og:title", content: "Admin · Acropolis Onboarding" },
      {
        property: "og:description",
        content: "Invite HRs and team leads, promote admins, and remove people who leave Acropolis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { activeOrg, isOwner } = useOrgContext();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Invite HRs and team leads by email, promote admins, and remove access when someone leaves.
      </p>

      <MembersCard orgId={activeOrg?.id} canManage={isOwner} />
    </main>
  );
}
