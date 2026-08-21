import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrgContext } from "@/lib/org-context";
import { createOrganization, slugify } from "@/lib/orgs";

export const Route = createFileRoute("/_authenticated/orgs")({
  head: () => ({
    meta: [
      { title: "Your organizations · Onboarding Control" },
      {
        name: "description",
        content:
          "Create an organization or switch between the organizations whose new hire provisioning you manage.",
      },
      { property: "og:title", content: "Your organizations" },
      {
        property: "og:description",
        content: "Pick the organization whose onboarding runs you want to watch.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrgsPage,
});

function OrgsPage() {
  const { orgs, activeOrg, isLoading, setActiveOrg } = useOrgContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: (value: string) => createOrganization(value),
    onSuccess: async (org) => {
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setActiveOrg(org.id);
      setName("");
      toast.success(`${org.name} is ready.`);
      navigate({ to: "/dashboard" });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not create the organization.");
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Your organizations</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Each organization keeps its own hires, approvals, webhook secret, and connected tools.
      </p>

      <section className="mt-8 space-y-3">
        {isLoading && <Skeleton className="h-16 w-full" />}
        {!isLoading && orgs.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            You are not in an organization yet. Create your first one below.
          </p>
        )}
        {orgs.map((org) => (
          <button
            key={org.id}
            type="button"
            onClick={() => {
              setActiveOrg(org.id);
              navigate({ to: "/dashboard" });
            }}
            className="flex w-full items-center gap-4 rounded-xl border border-border/70 bg-card p-5 text-left transition-colors hover:border-wait/50"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted font-mono text-sm uppercase">
              {org.name.slice(0, 2)}
            </span>
            <span className="min-w-0">
              <span className="block font-medium">{org.name}</span>
              <span className="block font-mono text-xs text-muted-foreground">/{org.slug}</span>
            </span>
            {activeOrg?.id === org.id && (
              <span className="ml-auto rounded-full border border-ok/40 bg-ok/10 px-2 py-0.5 text-xs text-ok">
                active
              </span>
            )}
          </button>
        ))}
      </section>

      <section className="mt-10 rounded-xl border border-border/70 bg-card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Create organization
        </h2>
        <form
          className="mt-4 flex flex-wrap items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const value = name.trim();
            if (value.length < 2) {
              toast.error("Give the organization a name first.");
              return;
            }
            create.mutate(value);
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Acme Robotics"
            maxLength={80}
            className="max-w-xs"
            aria-label="Organization name"
          />
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
          {name.trim().length > 1 && (
            <span className="font-mono text-xs text-muted-foreground">/{slugify(name)}</span>
          )}
        </form>
      </section>
    </main>
  );
}
