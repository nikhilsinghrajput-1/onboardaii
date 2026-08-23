import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type Verdict = "pending" | "verified" | "unverified" | "discrepancy";
export type CheckStatus = "draft" | "running" | "review" | "cleared" | "flagged";

export type BackgroundCheck = {
  id: string;
  hire_id: string;
  status: CheckStatus;
  risk_score: number;
  summary: string | null;
  ai_error: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type BackgroundClaim = {
  id: string;
  check_id: string;
  category: string;
  claim: string;
  evidence: string | null;
  verdict: Verdict;
  finding: string | null;
  confidence: number | null;
  updated_at: string;
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  pending: "Awaiting review",
  verified: "Verified",
  unverified: "Not verified",
  discrepancy: "Discrepancy",
};

export const VERDICT_TONE: Record<Verdict, string> = {
  pending: "border-border text-muted-foreground",
  verified: "border-ok/40 bg-ok/10 text-ok",
  unverified: "border-wait/40 bg-wait/10 text-wait",
  discrepancy: "border-destructive/40 bg-destructive/10 text-destructive",
};

export const CHECK_TONE: Record<CheckStatus, string> = {
  draft: "border-border text-muted-foreground",
  running: "border-run/40 bg-run/10 text-run",
  review: "border-wait/40 bg-wait/10 text-wait",
  cleared: "border-ok/40 bg-ok/10 text-ok",
  flagged: "border-destructive/40 bg-destructive/10 text-destructive",
};

export const CATEGORY_LABEL: Record<string, string> = {
  identity: "Identity",
  employment: "Employment",
  education: "Education",
  certification: "Certification",
  reference: "Reference",
  criminal: "Criminal record",
  online: "Online presence",
};

export const checksQuery = (orgId: string | undefined) =>
  queryOptions({
    queryKey: ["background-checks", orgId],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<BackgroundCheck[]> => {
      const { data, error } = await supabase
        .from("background_checks")
        .select("id, hire_id, status, risk_score, summary, ai_error, completed_at, updated_at")
        .eq("org_id", orgId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BackgroundCheck[];
    },
  });

export const claimsQuery = (orgId: string | undefined, checkId: string | undefined) =>
  queryOptions({
    queryKey: ["background-claims", orgId, checkId],
    enabled: Boolean(orgId && checkId),
    queryFn: async (): Promise<BackgroundClaim[]> => {
      const { data, error } = await supabase
        .from("background_check_claims")
        .select("id, check_id, category, claim, evidence, verdict, finding, confidence, updated_at")
        .eq("org_id", orgId!)
        .eq("check_id", checkId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BackgroundClaim[];
    },
  });

export type Signal = {
  id: string;
  hire_id: string;
  source: "github" | "slack" | "jira";
  live: boolean;
  captured_at: string;
  metrics: Record<string, number>;
};

export const signalsQuery = (orgId: string | undefined, hireId: string | undefined) =>
  queryOptions({
    queryKey: ["signals", orgId, hireId],
    enabled: Boolean(orgId && hireId),
    queryFn: async (): Promise<Signal[]> => {
      const { data, error } = await supabase
        .from("employee_signals")
        .select("id, hire_id, source, live, captured_at, metrics")
        .eq("org_id", orgId!)
        .eq("hire_id", hireId!);
      if (error) throw error;
      return (data ?? []) as Signal[];
    },
  });

export const SOURCE_LABEL: Record<string, string> = {
  github: "GitHub",
  slack: "Slack",
  jira: "Jira",
};

export const METRIC_LABEL: Record<string, string> = {
  prs_opened: "PRs opened",
  prs_merged: "PRs merged",
  review_comments: "Review comments",
  avg_merge_hours: "Avg merge (h)",
  commits: "Commits",
  reverts: "Reverts",
  messages: "Messages",
  channels: "Channels",
  median_response_minutes: "Median reply (min)",
  after_hours_pct: "After hours %",
  threads_started: "Threads started",
  helpfulness: "Helpfulness",
  tickets_assigned: "Tickets assigned",
  tickets_done: "Tickets done",
  story_points: "Story points",
  avg_cycle_days: "Avg cycle (days)",
  overdue: "Overdue",
  reopened: "Reopened",
};

export function metricLabel(key: string): string {
  return METRIC_LABEL[key] ?? key.replace(/_/g, " ");
}
