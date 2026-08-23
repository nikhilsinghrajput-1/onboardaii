import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Github, MessageSquare, RefreshCw, SquareKanban, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPerformanceBrief, refreshSignals } from "@/lib/bi.functions";
import { hiresQuery } from "@/lib/dashboard-data";
import { SOURCE_LABEL, metricLabel, signalsQuery, type Signal } from "@/lib/insights-data";
import { useOrgContext } from "@/lib/org-context";

export const Route = createFileRoute("/_authenticated/intelligence")({
  head: () => ({
    meta: [
      { title: "Business intelligence · Keystone" },
      {
        name: "description",
        content:
          "Per-employee performance intelligence: GitHub pull requests and review load, Slack collaboration patterns, Jira delivery throughput, and an AI read on how they are trending.",
      },
      { property: "og:title", content: "Business intelligence · Keystone" },
      {
        property: "og:description",
        content: "GitHub, Slack and Jira signals per employee with an AI performance brief.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IntelligencePage,
});

const SOURCE_ICON = {
  github: Github,
  slack: MessageSquare,
  jira: SquareKanban,
} as const;

function SourceCard({ signal }: { signal: Signal }) {
  const Icon = SOURCE_ICON[signal.source];
  const entries = Object.entries(signal.metrics ?? {});
  const max = Math.max(1, ...entries.map(([, v]) => Number(v) || 0));

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h2 className="text-sm font-medium">{SOURCE_LABEL[signal.source]}</h2>
        <span
          className={`ml-auto rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${
            signal.live ? "border-ok/40 bg-ok/10 text-ok" : "border-border text-muted-foreground"
          }`}
        >
          {signal.live ? "live" : "sample"}
        </span>
      </div>
      <ul className="mt-4 space-y-2.5">
        {entries.map(([key, value]) => (
          <li key={key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{metricLabel(key)}</span>
              <span className="font-mono">{value}</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-muted">
              <div
                className="h-1 rounded-full bg-primary/70"
                style={{ width: `${Math.min(100, ((Number(value) || 0) / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 font-mono text-[11px] text-muted-foreground">
        captured {new Date(signal.captured_at).toLocaleString()}
      </p>
    </section>
  );
}

function IntelligencePage() {
  const { activeOrg } = useOrgContext();
  const orgId = activeOrg?.id;
  const queryClient = useQueryClient();

  const hires = useQuery(hiresQuery(orgId));
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const hireId = selected ?? hires.data?.[0]?.id;
  const hire = hires.data?.find((h) => h.id === hireId);
  const signals = useQuery(signalsQuery(orgId, hireId));

  const sync = useServerFn(refreshSignals);
  const fetchBrief = useServerFn(getPerformanceBrief);
  const [busy, setBusy] = useState(false);

  const brief = useQuery({
    queryKey: ["performance-brief", orgId, hireId],
    enabled: Boolean(orgId && hireId),
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchBrief({ data: { orgId: orgId!, hireId: hireId! } }),
  });

  const refreshAll = async (regenerate: boolean) => {
    if (!orgId || !hireId) return;
    setBusy(true);
    try {
      await sync({ data: { orgId, hireId } });
      await queryClient.invalidateQueries({ queryKey: ["signals", orgId, hireId] });
      if (regenerate) {
        const fresh = await fetchBrief({ data: { orgId, hireId, force: true } });
        queryClient.setQueryData(["performance-brief", orgId, hireId], fresh);
      }
      toast.success("Signals refreshed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not refresh signals");
    } finally {
      setBusy(false);
    }
  };

  const ordered = ["github", "slack", "jira"]
    .map((s) => (signals.data ?? []).find((sig) => sig.source === s))
    .filter((s): s is Signal => Boolean(s));

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Business intelligence</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pick a person and see how they actually work: pull requests and review load from GitHub,
            collaboration patterns from Slack, delivery throughput from Jira — plus an AI read on
            what to celebrate and what to coach.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={hireId ?? ""} onValueChange={setSelected}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select an employee" />
            </SelectTrigger>
            <SelectContent>
              {(hires.data ?? []).map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.full_name} · {h.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="secondary" disabled={busy || !hireId} onClick={() => refreshAll(false)}>
            <RefreshCw className={busy ? "animate-spin" : ""} />
            Refresh signals
          </Button>
          <Button disabled={busy || !hireId} onClick={() => refreshAll(true)}>
            <Sparkles />
            Rebuild brief
          </Button>
        </div>
      </div>

      {hires.data?.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No employees yet. Add a hire on the Overview and their signals show up here.
        </p>
      )}

      {hire && (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_260px]">
            <div
              className="rounded-2xl border border-primary/25 p-6"
              style={{ backgroundImage: "var(--gradient-keystone)" }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h2 className="text-sm font-medium uppercase tracking-wide text-primary">
                  Performance brief · {hire.full_name}
                </h2>
              </div>
              {brief.isLoading && <Skeleton className="mt-4 h-16 w-full" />}
              {brief.data?.error && (
                <p className="mt-3 text-sm text-muted-foreground">{brief.data.error}</p>
              )}
              {brief.data?.headline && (
                <p className="mt-3 max-w-3xl text-sm leading-relaxed">{brief.data.headline}</p>
              )}
              <div className="mt-5 grid gap-5 sm:grid-cols-3">
                {(
                  [
                    ["Strengths", brief.data?.strengths, "text-ok"],
                    ["Risks", brief.data?.risks, "text-wait"],
                    ["Coaching", brief.data?.coaching, "text-primary"],
                  ] as const
                ).map(([label, items, tone]) => (
                  <div key={label}>
                    <p className={`text-xs font-medium uppercase tracking-wide ${tone}`}>{label}</p>
                    <ul className="mt-2 space-y-1.5">
                      {(items ?? []).map((item) => (
                        <li key={item} className="text-sm text-muted-foreground">
                          {item}
                        </li>
                      ))}
                      {(items ?? []).length === 0 && (
                        <li className="text-sm text-muted-foreground">—</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-6 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Contribution health
              </p>
              <p className="mt-3 font-mono text-5xl text-primary">{brief.data?.score ?? 0}</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">out of 100</p>
              <div className="mt-5 h-1.5 rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-primary"
                  style={{ width: `${Math.min(100, brief.data?.score ?? 0)}%` }}
                />
              </div>
              <p className="mt-4 text-left text-xs text-muted-foreground">
                {hire.role} · {hire.department}
                {hire.start_date ? ` · started ${hire.start_date}` : ""}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {signals.isLoading && <Skeleton className="h-56 w-full" />}
            {ordered.map((signal) => (
              <SourceCard key={signal.id} signal={signal} />
            ))}
            {!signals.isLoading && ordered.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground lg:col-span-3">
                No signals captured for {hire.full_name} yet. Hit “Refresh signals”.
              </p>
            )}
          </div>

          <p className="mt-6 max-w-3xl text-xs text-muted-foreground">
            Sources marked <span className="font-mono">sample</span> have no live connector yet —
            Slack reads from Keystone&apos;s own record, and GitHub or Jira numbers stay a sample
            snapshot until real metrics are pushed in.
          </p>
        </>
      )}
    </main>
  );
}
