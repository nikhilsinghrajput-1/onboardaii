import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AiBriefingCard } from "@/components/AiBriefingCard";
import { AskKeystone } from "@/components/AskKeystone";
import { NewHireDialog } from "@/components/NewHireDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { listOrgConnections } from "@/lib/connections.functions";
import { CONNECTOR_CATALOG } from "@/lib/connector-catalog";
import {
  activityQuery,
  countByStatus,
  hiresQuery,
  tasksQuery,
  toolLabel,
  toolStates,
  type Task,
  type TaskStatus,
} from "@/lib/dashboard-data";
import { useOrgContext } from "@/lib/org-context";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Overview · Keystone onboarding operations" },
      {
        name: "description",
        content:
          "Keystone's control room for Acropolis onboarding: AI briefing, live provisioning across Slack, Gmail, Calendar, Drive, Sheets and Notion, and everything waiting on a human.",
      },
      { property: "og:title", content: "Keystone overview" },
      {
        property: "og:description",
        content:
          "AI briefing, live provisioning board and tool health for every new hire at Acropolis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const CHIP_TONE: Record<TaskStatus, string> = {
  completed: "border-ok/40 bg-ok/10 text-ok",
  in_progress: "border-run/40 bg-run/10 text-run",
  needs_human: "border-wait/40 bg-wait/10 text-wait",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
  not_started: "border-border text-muted-foreground",
};

function Ring({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div
      className="relative grid size-14 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(var(--ok) ${pct}%, var(--muted) ${pct}% 100%)` }}
      aria-label={`${pct}% complete`}
    >
      <div className="grid size-11 place-items-center rounded-full bg-card font-mono text-xs">
        {pct}%
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-2xl ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function DashboardPage() {
  useRealtimeRefresh();
  const { activeOrg } = useOrgContext();
  const orgId = activeOrg?.id;
  const hires = useQuery(hiresQuery(orgId));
  const tasks = useQuery(tasksQuery(orgId));
  const activity = useQuery(activityQuery(orgId));
  const fetchConnections = useServerFn(listOrgConnections);
  const connections = useQuery({
    queryKey: ["org-connections", orgId],
    enabled: Boolean(orgId),
    queryFn: () => fetchConnections({ data: { orgId: orgId! } }),
  });

  const byHire = new Map<string, Task[]>();
  for (const t of tasks.data ?? []) {
    const list = byHire.get(t.hire_id) ?? [];
    list.push(t);
    byHire.set(t.hire_id, list);
  }
  const totals = countByStatus(tasks.data ?? []);

  const today = new Date().toDateString();
  const doneToday = (tasks.data ?? []).filter(
    (t) => t.status === "completed" && new Date(t.updated_at).toDateString() === today,
  ).length;
  const inFlight = (hires.data ?? []).filter((h) => {
    const list = byHire.get(h.id) ?? [];
    return list.length > 0 && list.some((t) => t.status !== "completed");
  }).length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Keystone runs onboarding for {activeOrg?.name ?? "Acropolis"} across every connected
            tool — Slack, Gmail, Calendar, Drive, Sheets, Notion and Teams — and parks anything
            sensitive for a human.
          </p>
        </div>
        <div className="ml-auto">
          <NewHireDialog orgId={orgId} />
        </div>
      </div>

      <div className="mt-6">
        <AiBriefingCard orgId={orgId} />
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Hires in flight" value={inFlight} tone="text-run" />
        <Metric label="Done today" value={doneToday} tone="text-ok" />
        <Metric label="Needs approval" value={totals.needs_human} tone="text-wait" />
        <Metric label="Failed" value={totals.failed} tone="text-destructive" />
        <Metric
          label="Tools live"
          value={`${(connections.data ?? []).filter((c) => c.connected).length}/${CONNECTOR_CATALOG.length}`}
        />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Provisioning board
          </h2>
          {hires.isLoading && <Skeleton className="h-24 w-full" />}
          {hires.error && (
            <p className="text-sm text-destructive">Could not load hires. Try refreshing.</p>
          )}
          {hires.data?.length === 0 && (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No hires yet. Add one and Keystone starts provisioning immediately.
            </p>
          )}
          {hires.data?.map((hire) => {
            const list = byHire.get(hire.id) ?? [];
            const counts = countByStatus(list);
            return (
              <Link
                key={hire.id}
                to="/hires/$hireId"
                params={{ hireId: hire.id }}
                className="block rounded-xl border border-border/70 bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-wrap items-center gap-5">
                  <Ring done={counts.completed} total={list.length} />
                  <div className="min-w-48">
                    <p className="font-medium">{hire.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {hire.role} · {hire.department}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {hire.location ?? "—"} · starts {hire.start_date ?? "TBD"}
                    </p>
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {counts.needs_human > 0 && <StatusBadge status="needs_human" />}
                    {counts.failed > 0 && <StatusBadge status="failed" />}
                    <span className="font-mono text-xs text-muted-foreground">
                      {counts.completed}/{list.length} tasks
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {toolStates(list).map(({ tool, status }) => (
                    <span
                      key={tool}
                      className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${CHIP_TONE[status]}`}
                    >
                      {toolLabel(tool)}
                    </span>
                  ))}
                  {list.length === 0 && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      no tasks planned yet
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </section>

        <div className="space-y-6">
          <AskKeystone orgId={orgId} />

          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Activity
            </h2>
            <ul className="mt-3 space-y-2.5">
              {activity.isLoading && <Skeleton className="h-20 w-full" />}
              {activity.data?.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Nothing yet — actions Keystone takes show up here.
                </li>
              )}
              {activity.data?.map((entry) => (
                <li key={entry.id} className="text-sm">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span
                      className={
                        entry.outcome === "ok"
                          ? "text-ok"
                          : entry.outcome === "failed"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }
                    >
                      {toolLabel(entry.tool)}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{entry.action}</span>
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                      {new Date(entry.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  {entry.detail && (
                    <p className="truncate text-xs text-muted-foreground">{entry.detail}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Tool health
            </h2>
            <ul className="mt-3 space-y-2">
              {CONNECTOR_CATALOG.map((spec) => {
                const live = Boolean(connections.data?.find((c) => c.id === spec.id)?.connected);
                return (
                  <li key={spec.id} className="flex items-center gap-2 text-sm">
                    <span
                      className={`size-2 rounded-full ${live ? "bg-ok" : "bg-muted-foreground/35"}`}
                    />
                    <span>{spec.label}</span>
                    <span
                      className={`ml-auto font-mono text-[11px] ${live ? "text-ok" : "text-muted-foreground"}`}
                    >
                      {live ? "live" : "not connected"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
