import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { type ReactNode } from "react";

import { KeystoneSidebar } from "@/components/KeystoneSidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
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
  return (
    <OrgProvider>
      <SidebarProvider>
        <KeystoneSidebar />
        <SidebarInset className="min-h-screen">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur">
            <SidebarTrigger />
            <span className="font-mono text-xs uppercase tracking-[0.22em] text-primary">
              Keystone
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              onboarding operations · Acropolis
            </span>
          </header>
          <MemberGate>
            <Outlet />
          </MemberGate>
        </SidebarInset>
      </SidebarProvider>
    </OrgProvider>
  );
}
