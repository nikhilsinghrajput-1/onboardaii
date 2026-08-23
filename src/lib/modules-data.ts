import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type Candidate = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department: string;
  stage: string;
  notes: string | null;
  track_id: string | null;
  user_id: string | null;
  invite_sent_at: string | null;
  invite_error: string | null;
  created_at: string;
};

export type ModuleTrack = {
  id: string;
  title: string;
  role_key: string;
  summary: string | null;
  source: string;
  created_at: string;
};

export type ModuleItem = {
  id: string;
  track_id: string;
  position: number;
  title: string;
  content: string;
  duration_minutes: number;
};

export type CandidateAssessment = {
  id: string;
  candidate_id: string;
  status: string;
  score: number | null;
  max_score: number | null;
  ai_feedback: string | null;
  submitted_at: string | null;
};

export const candidatesQuery = (orgId: string | undefined) =>
  queryOptions({
    queryKey: ["candidates", orgId],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<Candidate[]> => {
      const { data, error } = await supabase
        .from("candidates")
        .select(
          "id, full_name, email, role, department, stage, notes, track_id, user_id, invite_sent_at, invite_error, created_at",
        )
        .eq("org_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Candidate[];
    },
  });

export const tracksQuery = (orgId: string | undefined) =>
  queryOptions({
    queryKey: ["module-tracks", orgId],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<{ tracks: ModuleTrack[]; items: ModuleItem[] }> => {
      const [tracks, items] = await Promise.all([
        supabase
          .from("module_tracks")
          .select("id, title, role_key, summary, source, created_at")
          .eq("org_id", orgId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("module_items")
          .select("id, track_id, position, title, content, duration_minutes")
          .eq("org_id", orgId!)
          .order("position", { ascending: true }),
      ]);
      if (tracks.error) throw tracks.error;
      if (items.error) throw items.error;
      return {
        tracks: (tracks.data ?? []) as ModuleTrack[],
        items: (items.data ?? []) as ModuleItem[],
      };
    },
  });

export const candidateProgressQuery = (orgId: string | undefined) =>
  queryOptions({
    queryKey: ["candidate-progress", orgId],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<{
      progress: { candidate_id: string; module_item_id: string; status: string }[];
      assessments: CandidateAssessment[];
    }> => {
      const [progress, assessments] = await Promise.all([
        supabase
          .from("candidate_module_progress")
          .select("candidate_id, module_item_id, status")
          .eq("org_id", orgId!),
        supabase
          .from("candidate_assessments")
          .select("id, candidate_id, status, score, max_score, ai_feedback, submitted_at")
          .eq("org_id", orgId!),
      ]);
      if (progress.error) throw progress.error;
      if (assessments.error) throw assessments.error;
      return {
        progress: (progress.data ?? []) as {
          candidate_id: string;
          module_item_id: string;
          status: string;
        }[],
        assessments: (assessments.data ?? []) as CandidateAssessment[],
      };
    },
  });

export const STAGE_LABEL: Record<string, string> = {
  invited: "Invited",
  learning: "Working through modules",
  assessed: "Assessment graded",
  hired: "Hired",
};
