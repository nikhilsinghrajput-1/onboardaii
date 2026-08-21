import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "failed"
  | "needs_human";

export type Hire = {
  id: string;
  external_id: string | null;
  full_name: string;
  email: string | null;
  role: string;
  department: string;
  seniority: string | null;
  employment_type: string | null;
  location: string | null;
  start_date: string | null;
  pii_access: boolean;
  on_call: boolean;
  direct_reports: boolean;
  owning_team: string | null;
  slack_channel_id: string | null;
  slack_channel_name: string | null;
  slack_channel_error: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  hire_id: string;
  external_task_id: string | null;
  system: string;
  action: string;
  reason: string | null;
  confidence: number | null;
  sensitive: boolean;
  status: TaskStatus;
  retry_count: number;
  error_message: string | null;
  raw_response: string | null;
  updated_at: string;
  created_at: string;
};

export type Approval = {
  id: string;
  task_id: string;
  decision: "approved" | "rejected";
  note: string;
  decided_by_label: string | null;
  channel: string;
  created_at: string;
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  failed: "Failed",
  needs_human: "Needs approval",
};

export const hiresQuery = (orgId: string | undefined) =>
  queryOptions({
    queryKey: ["hires", orgId],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<Hire[]> => {
      const { data, error } = await supabase
        .from("hires")
        .select("*")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Hire[];
    },
  });

export const tasksQuery = (orgId: string | undefined) =>
  queryOptions({
    queryKey: ["tasks", orgId],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("onboarding_tasks")
        .select("*")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

export const approvalsQuery = (orgId: string | undefined) =>
  queryOptions({
    queryKey: ["approvals", orgId],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<Approval[]> => {
      const { data, error } = await supabase
        .from("approvals")
        .select("*")
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Approval[];
    },
  });

export function countByStatus(tasks: Task[]) {
  const counts: Record<TaskStatus, number> = {
    not_started: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    needs_human: 0,
  };
  for (const t of tasks) counts[t.status] += 1;
  return counts;
}
