import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  CheckCircle2,
  Gauge,
  LogOut,
  Plug,
  ScanSearch,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { listOrgConnections } from "@/lib/connections.functions";
import { CONNECTOR_CATALOG } from "@/lib/connector-catalog";
import { tasksQuery } from "@/lib/dashboard-data";
import { useOrgContext } from "@/lib/org-context";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: Gauge },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck },
  { to: "/background-checks", label: "Background checks", icon: ScanSearch },
  { to: "/intelligence", label: "Intelligence", icon: BarChart3 },
  { to: "/integrations", label: "Tools", icon: Plug },
  { to: "/admin", label: "Members", icon: Users },
] as const;

export function KeystoneSidebar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeOrg, userEmail } = useOrgContext();
  const orgId = activeOrg?.id;
  const tasks = useQuery(tasksQuery(orgId));
  const fetchConnections = useServerFn(listOrgConnections);
  const connections = useQuery({
    queryKey: ["org-connections", orgId],
    enabled: Boolean(orgId),
    queryFn: () => fetchConnections({ data: { orgId: orgId! } }),
  });

  const pending = (tasks.data ?? []).filter((t) => t.status === "needs_human").length;
  const liveTools = (connections.data ?? []).filter((c) => c.connected).length;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary font-mono text-sm font-semibold text-primary-foreground">
            K
          </span>
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block truncate text-sm font-semibold tracking-tight">Keystone</span>
            <span className="block truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {activeOrg?.name ?? "Acropolis"}
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarMenu>
            {NAV.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton asChild tooltip={item.label}>
                  <Link
                    to={item.to}
                    className="[&.active]:bg-sidebar-accent [&.active]:text-sidebar-accent-foreground"
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
                {item.to === "/approvals" && pending > 0 && (
                  <SidebarMenuBadge className="text-wait">{pending}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Tool health</SidebarGroupLabel>
          <div className="px-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-ok" />
              <span className="font-mono">
                {liveTools}/{CONNECTOR_CATALOG.length} live
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {CONNECTOR_CATALOG.map((spec) => {
                const live = Boolean(connections.data?.find((c) => c.id === spec.id)?.connected);
                return (
                  <span
                    key={spec.id}
                    title={`${spec.label}: ${live ? "live" : "not connected"}`}
                    className={`size-1.5 rounded-full ${live ? "bg-ok" : "bg-muted-foreground/35"}`}
                  />
                );
              })}
            </div>
          </div>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={async () => {
                await queryClient.cancelQueries();
                queryClient.clear();
                await supabase.auth.signOut();
                navigate({ to: "/auth", search: { next: undefined }, replace: true });
              }}
            >
              <LogOut />
              <span className="truncate">{userEmail ?? "Sign out"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
