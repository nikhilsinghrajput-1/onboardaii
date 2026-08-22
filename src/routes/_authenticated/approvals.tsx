import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { decideTask } from "@/lib/approvals.functions";
import { approvalsQuery, hiresQuery, tasksQuery } from "@/lib/dashboard-data";
import { useOrgContext } from "@/lib/org-context";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Approval queue · Acropolis Onboarding" },
      {
        name: "description",
        content:
          "Approve or reject provisioning tasks that touch sensitive systems or came back with low confidence, with a full audit trail.",
      },
      { property: "og:title", content: "Approval queue" },
      {
        property: "og:description",
        content: "Human approval gate for sensitive and low-confidence provisioning actions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  useRealtimeRefresh();
  const queryClient = useQueryClient();
  const { activeOrg } = useOrgContext();
  const orgId = activeOrg?.id;
  const hires = useQuery(hiresQuery(orgId));
  const tasks = useQuery(tasksQuery(orgId));
  const approvals = useQuery(approvalsQuery(orgId));
  const decide = useServerFn(decideTask);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (vars: { taskId: string; decision: "approved" | "rejected"; note: string }) =>
      decide({ data: { ...vars, orgId: orgId! } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message ?? "Nothing to record.");
        return;
      }
      toast.success(
        result.resumed
          ? "Decision recorded and sent back to the flow."
          : "Decision recorded. The flow callback is not configured yet.",
      );
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: () => toast.error("Could not record that decision."),
  });

  const pending = (tasks.data ?? []).filter((t) => t.status === "needs_human");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Approval queue</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sensitive systems and low-confidence suggestions land here before anything is provisioned.
      </p>

      {tasks.isLoading && <Skeleton className="mt-8 h-32 w-full" />}

      {!tasks.isLoading && pending.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nothing waiting on a human right now.
        </p>
      )}

      <ul className="mt-8 space-y-3">
        {pending.map((task) => {
          const hire = hires.data?.find((h) => h.id === task.hire_id);
          const note = notes[task.id] ?? "";
          const busy = mutation.isPending && mutation.variables?.taskId === task.id;
          return (
            <li key={task.id} className="rounded-xl border border-wait/30 bg-card p-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-medium">{hire?.full_name ?? "Unknown hire"}</span>
                <Link
                  to="/hires/$hireId"
                  params={{ hireId: task.hire_id }}
                  className="font-mono text-xs text-wait hover:underline"
                >
                  view hire
                </Link>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  confidence {task.confidence ?? "—"}
                </span>
              </div>
              <p className="mt-2 font-mono text-sm">
                {task.system} · {task.action}
              </p>
              {task.reason && <p className="mt-1 text-sm text-muted-foreground">{task.reason}</p>}
              {task.sensitive && (
                <p className="mt-2 text-xs text-wait">
                  Routed here by the deterministic guardrail — a sensitive system, regardless of
                  confidence.
                </p>
              )}
              <Textarea
                className="mt-4"
                rows={2}
                placeholder="Why are you approving or rejecting this? (required)"
                value={note}
                onChange={(e) => setNotes({ ...notes, [task.id]: e.target.value })}
              />
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  disabled={note.trim().length < 3 || busy}
                  onClick={() =>
                    mutation.mutate({ taskId: task.id, decision: "approved", note: note.trim() })
                  }
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={note.trim().length < 3 || busy}
                  onClick={() =>
                    mutation.mutate({ taskId: task.id, decision: "rejected", note: note.trim() })
                  }
                >
                  Reject
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="mt-14">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Decision audit trail
        </h2>
        <ul className="mt-3 divide-y divide-border/70 rounded-xl border border-border/70 bg-card">
          {(approvals.data ?? []).length === 0 && (
            <li className="p-5 text-sm text-muted-foreground">No decisions recorded yet.</li>
          )}
          {(approvals.data ?? []).map((a) => {
            const task = tasks.data?.find((t) => t.id === a.task_id);
            const hire = hires.data?.find((h) => h.id === task?.hire_id);
            return (
              <li key={a.id} className="flex flex-wrap gap-x-3 gap-y-1 p-4 text-sm">
                <span className={a.decision === "approved" ? "text-ok" : "text-destructive"}>
                  {a.decision === "approved" ? "Approved" : "Rejected"}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {task ? `${task.system} · ${task.action}` : "task removed"}
                </span>
                <span className="text-muted-foreground">{hire?.full_name ?? ""}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {a.decided_by_label ?? "unknown"} · {a.channel} ·{" "}
                  {new Date(a.created_at).toLocaleString()}
                </span>
                <p className="w-full text-xs text-muted-foreground">{a.note}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
