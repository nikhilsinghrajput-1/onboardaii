import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function OrgSwitcher() {
  const { orgs, activeOrg, setActiveOrg } = useOrgContext();
  const navigate = useNavigate();
  if (!activeOrg) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="font-normal">
          {activeOrg.name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => {
              setActiveOrg(org.id);
              navigate({ to: "/dashboard" });
            }}
          >
            <span className="truncate">{org.name}</span>
            {org.id === activeOrg.id && <span className="ml-auto text-xs text-ok">active</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate({ to: "/orgs" })}>
          Manage organizations
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Sends people without an organization to the create/select screen. */
function OrgGate({ children }: { children: ReactNode }) {
  const { orgs, isLoading } = useOrgContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (isLoading || pathname === "/orgs") return;
    if (orgs.length === 0) navigate({ to: "/orgs", replace: true });
  }, [isLoading, orgs.length, pathname, navigate]);

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
              Onboarding Control
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {[
                { to: "/dashboard", label: "Hires" },
                { to: "/approvals", label: "Approvals" },
                { to: "/integrations", label: "Wiring" },
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
              <OrgSwitcher />
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
        <OrgGate>
          <Outlet />
        </OrgGate>
      </div>
    </OrgProvider>
  );
}
