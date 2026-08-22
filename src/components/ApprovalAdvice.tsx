import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { getApprovalAdvice } from "@/lib/ai.functions";

const RISK_TONE: Record<string, string> = {
  low: "text-ok border-ok/40 bg-ok/10",
  medium: "text-wait border-wait/40 bg-wait/10",
  high: "text-destructive border-destructive/40 bg-destructive/10",
};

/** AI risk read on one pending approval. The human still decides. */
export function ApprovalAdvice({ orgId, taskId }: { orgId: string | undefined; taskId: string }) {
  const advise = useServerFn(getApprovalAdvice);
  const advice = useQuery({
    queryKey: ["approval-advice", taskId],
    enabled: Boolean(orgId),
    staleTime: 10 * 60 * 1000,
    queryFn: () => advise({ data: { orgId: orgId!, taskId } }),
  });

  if (advice.isLoading) return <Skeleton className="mt-3 h-12 w-full" />;
  if (advice.error || advice.data?.error) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        {advice.data?.error ?? "Risk copilot unavailable right now."}
      </p>
    );
  }
  if (!advice.data) return null;

  return (
    <div className="mt-3 rounded-lg border border-border/70 bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlert className="size-3.5 text-primary" />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          risk copilot
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] ${RISK_TONE[advice.data.risk] ?? RISK_TONE["medium"]}`}
        >
          {advice.data.risk} risk
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          suggests: {advice.data.recommendation}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{advice.data.reasoning}</p>
    </div>
  );
}
