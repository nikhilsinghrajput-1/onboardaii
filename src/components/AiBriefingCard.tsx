import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getBriefing } from "@/lib/ai.functions";

export function AiBriefingCard({ orgId }: { orgId: string | undefined }) {
  const queryClient = useQueryClient();
  const fetchBriefing = useServerFn(getBriefing);

  const briefing = useQuery({
    queryKey: ["briefing", orgId],
    enabled: Boolean(orgId),
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchBriefing({ data: { orgId: orgId! } }),
  });

  const refresh = async () => {
    if (!orgId) return;
    const fresh = await fetchBriefing({ data: { orgId, force: true } });
    queryClient.setQueryData(["briefing", orgId], fresh);
  };

  return (
    <section
      className="rounded-2xl border border-primary/25 p-6"
      style={{ backgroundImage: "var(--gradient-keystone)" }}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-sm font-medium uppercase tracking-wide text-primary">
          Keystone briefing
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={refresh}
          disabled={briefing.isFetching}
        >
          <RefreshCw className={briefing.isFetching ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {briefing.isLoading && <Skeleton className="mt-4 h-16 w-full" />}
      {briefing.data?.error && (
        <p className="mt-3 text-sm text-muted-foreground">{briefing.data.error}</p>
      )}
      {briefing.data?.summary && (
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">{briefing.data.summary}</p>
      )}
      {(briefing.data?.nextActions?.length ?? 0) > 0 && (
        <ul className="mt-4 space-y-1.5">
          {briefing.data!.nextActions.map((action) => (
            <li key={action} className="flex gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{action}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
