import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { OrgProvider, useOrgContext } from "@/lib/org-context";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { next: location.href } });
    }
    return { user: data.user };
  },
  component: Shell,
});

/** Internal tool: only people on the member list get in. */
function MemberGate({ children }: { children: ReactNode }) {
  const { isLoading, isMember, userEmail } = useOrgContext();

  if (isLoading || isMember === null) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Skeleton className="h-24 w-full" />
      </main>
    );
  }

  if (!isMember) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-xl font-semibold tracking-tight">No access yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {userEmail ? <span className="font-mono">{userEmail}</span> : "This account"} is not on the
          Acropolis member list. Ask an admin to add you, then sign in again.
        </p>
      </main>
    );
  }

  return <>{children}</>;
}

function Shell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <OrgProvider>
      <div className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-4">
            <Link to="/dashboard" className="font-mono text-sm uppercase tracking-[0.2em] text-wait">
              Acropolis Onboarding
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {[
                { to: "/dashboard", label: "Hires" },
                { to: "/approvals", label: "Approvals" },
                { to: "/admin", label: "Admin" },

              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await queryClient.cancelQueries();
                  queryClient.clear();
                  await supabase.auth.signOut();
                  navigate({ to: "/auth", search: { next: undefined }, replace: true });
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </header>
        <MemberGate>
          <Outlet />
        </MemberGate>
      </div>
    </OrgProvider>
  );
}
