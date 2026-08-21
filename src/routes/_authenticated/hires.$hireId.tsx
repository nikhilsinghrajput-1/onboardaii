import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import {
  approvalsQuery,
  countByStatus,
  hiresQuery,
  STATUS_LABEL,
  tasksQuery,
  type TaskStatus,
} from "@/lib/dashboard-data";
import { useOrgContext } from "@/lib/org-context";

export const Route = createFileRoute("/_authenticated/hires/$hireId")({
  head: () => ({
    meta: [
      { title: "Hire provisioning detail · Onboarding Control" },
      {
        name: "description",
        content:
          "Every provisioning task for one hire, grouped by system, with retry counts and the raw API response behind each failure.",
      },
      { property: "og:title", content: "Hire provisioning detail" },
      {
        property: "og:description",
        content: "Task-level provisioning state, retries, and raw error payloads for a single hire.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HireDetail,
});

const FILTERS: (TaskStatus | "all")[] = [
  "all",
  "needs_human",
  "failed",
  "in_progress",
  "completed",
  "not_started",
];

function HireDetail() {
  useRealtimeRefresh();
  const { hireId } = Route.useParams();
  const { activeOrg } = useOrgContext();
  const orgId = activeOrg?.id;
  const hires = useQuery(hiresQuery(orgId));
  const tasks = useQuery(tasksQuery(orgId));
  const approvals = useQuery(approvalsQuery(orgId));
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [open, setOpen] = useState<string | null>(null);

  const hire = hires.data?.find((h) => h.id === hireId);
  const hireTasks = (tasks.data ?? []).filter((t) => t.hire_id === hireId);
  const shown = filter === "all" ? hireTasks : hireTasks.filter((t) => t.status === filter);
  const counts = countByStatus(hireTasks);

  const systems = [...new Set(shown.map((t) => t.system))];

  if (hires.isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  if (!hire) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Hire not found</h1>
        <Link to="/dashboard" className="mt-4 inline-block text-sm text-wait hover:underline">
          Back to all hires
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link to="/dashboard" className="font-mono text-xs text-muted-foreground hover:text-foreground">
        ← All hires
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{hire.full_name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {hire.role} · {hire.department} · {hire.seniority ?? "—"} · {hire.employment_type ?? "—"}
      </p>
      <dl className="mt-4 grid gap-x-8 gap-y-2 font-mono text-xs text-muted-foreground sm:grid-cols-2">
        <div>HR record: {hire.external_id ?? "—"}</div>
        <div>Email: {hire.email ?? "—"}</div>
        <div>Location: {hire.location ?? "—"}</div>
        <div>Start date: {hire.start_date ?? "TBD"}</div>
        <div>Owning team: {hire.owning_team ?? "—"}</div>
        <div>
          Flags: {hire.pii_access ? "PII " : ""}
          {hire.on_call ? "on-call " : ""}
          {hire.direct_reports ? "direct-reports" : ""}
          {!hire.pii_access && !hire.on_call && !hire.direct_reports ? "none" : ""}
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filter === f
                ? "border-wait/60 bg-wait/10 text-wait"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? `All (${hireTasks.length})` : `${STATUS_LABEL[f]} (${counts[f]})`}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-8">
        {systems.map((system) => (
          <section key={system}>
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {system}
            </h2>
            <ul className="mt-3 space-y-2">
              {shown
                .filter((t) => t.system === system)
                .map((task) => {
                  const decision = approvals.data?.find((a) => a.task_id === task.id);
                  return (
                    <li key={task.id} className="rounded-xl border border-border/70 bg-card p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-sm">{task.action}</span>
                        {task.sensitive && (
                          <span className="rounded-full border border-wait/40 px-2 py-0.5 text-xs text-wait">
                            sensitive
                          </span>
                        )}
                        <StatusBadge status={task.status} className="ml-auto" />
                      </div>
                      {task.reason && (
                        <p className="mt-2 text-sm text-muted-foreground">{task.reason}</p>
                      )}
                      <p className="mt-2 font-mono text-xs text-muted-foreground">
                        confidence {task.confidence ?? "—"} · retries {task.retry_count} · updated{" "}
                        {new Date(task.updated_at).toLocaleString()}
                      </p>
                      {decision && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {decision.decision === "approved" ? "Approved" : "Rejected"} by{" "}
                          {decision.decided_by_label ?? "unknown"} ({decision.channel}) —{" "}
                          {decision.note}
                        </p>
                      )}
                      {task.error_message && (
                        <p className="mt-2 text-sm text-destructive">{task.error_message}</p>
                      )}
                      {task.raw_response && (
                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setOpen(open === task.id ? null : task.id)}
                          >
                            {open === task.id ? "Hide raw response" : "Show raw API response"}
                          </Button>
                          {open === task.id && (
                            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
                              {task.raw_response}
                            </pre>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
        {shown.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No tasks match this filter.
          </p>
        )}
      </div>
    </main>
  );
}
