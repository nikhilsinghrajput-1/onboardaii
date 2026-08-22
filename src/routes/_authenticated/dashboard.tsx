import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { NewHireDialog } from "@/components/NewHireDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { countByStatus, hiresQuery, tasksQuery, type Task } from "@/lib/dashboard-data";
import { useOrgContext } from "@/lib/org-context";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "New hire provisioning status · Acropolis Onboarding" },
      {
        name: "description",
        content:
          "Live view of every new hire's provisioning tasks: completed, in progress, failed, and awaiting human approval.",
      },
      { property: "og:title", content: "New hire provisioning status" },
      {
        property: "og:description",
        content: "Live provisioning state for every new hire, pushed in by the automation flow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function Ring({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div
      className="relative grid size-14 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(var(--ok) ${pct}%, var(--muted) ${pct}% 100%)`,
      }}
      aria-label={`${pct}% complete`}
    >
      <div className="grid size-11 place-items-center rounded-full bg-card font-mono text-xs">
        {pct}%
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-2xl ${tone}`}>{value}</p>
    </div>
  );
}

function DashboardPage() {
  useRealtimeRefresh();
  const { activeOrg } = useOrgContext();
  const orgId = activeOrg?.id;
  const hires = useQuery(hiresQuery(orgId));
  const tasks = useQuery(tasksQuery(orgId));

  const byHire = new Map<string, Task[]>();
  for (const t of tasks.data ?? []) {
    const list = byHire.get(t.hire_id) ?? [];
    list.push(t);
    byHire.set(t.hire_id, list);
  }
  const totals = countByStatus(tasks.data ?? []);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New hire provisioning</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a hire here or let the automation flow push state in after every action step.
            Updates land live.
          </p>
        </div>
        <div className="ml-auto">
          <NewHireDialog orgId={orgId} />
        </div>
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Completed" value={totals.completed} tone="text-ok" />
        <StatCard label="In progress" value={totals.in_progress} tone="text-run" />
        <StatCard label="Needs approval" value={totals.needs_human} tone="text-wait" />
        <StatCard label="Failed" value={totals.failed} tone="text-destructive" />
        <StatCard label="Not started" value={totals.not_started} tone="text-muted-foreground" />
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Hires</h2>
        {hires.isLoading && <Skeleton className="h-24 w-full" />}
        {hires.error && (
          <p className="text-sm text-destructive">Could not load hires. Try refreshing.</p>
        )}
        {hires.data?.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No hires yet. Once the HR trigger fires, they appear here.
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
              className="flex flex-wrap items-center gap-5 rounded-xl border border-border/70 bg-card p-5 transition-colors hover:border-wait/50"
            >
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
              <div className="flex flex-wrap items-center gap-2">
                {hire.pii_access && (
                  <span className="rounded-full border border-wait/40 bg-wait/10 px-2 py-0.5 text-xs text-wait">
                    PII access
                  </span>
                )}
                {hire.on_call && (
                  <span className="rounded-full border border-run/40 bg-run/10 px-2 py-0.5 text-xs text-run">
                    On-call
                  </span>
                )}
                {hire.direct_reports && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                    Direct reports
                  </span>
                )}
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {counts.needs_human > 0 && (
                  <StatusBadge status="needs_human" className="shrink-0" />
                )}
                {counts.failed > 0 && <StatusBadge status="failed" className="shrink-0" />}
                <span className="font-mono text-xs text-muted-foreground">
                  {counts.completed}/{list.length} tasks
                </span>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
