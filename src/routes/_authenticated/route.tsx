import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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

function Shell() {
  const navigate = useNavigate();

  return (
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
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth", search: { next: undefined } });
            }}
          >
            Sign out
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
