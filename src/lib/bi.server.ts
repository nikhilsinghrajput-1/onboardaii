import { aiText, parseJsonLoose } from "./ai.server";

export type SignalSource = "github" | "slack" | "jira";

export type GithubMetrics = {
  prs_opened: number;
  prs_merged: number;
  review_comments: number;
  avg_merge_hours: number;
  commits: number;
  reverts: number;
};

export type SlackMetrics = {
  messages: number;
  channels: number;
  median_response_minutes: number;
  after_hours_pct: number;
  threads_started: number;
  helpfulness: number;
};

export type JiraMetrics = {
  tickets_assigned: number;
  tickets_done: number;
  story_points: number;
  avg_cycle_days: number;
  overdue: number;
  reopened: number;
};

/** Deterministic pseudo-random in [0,1) from a string seed. */
function seeded(seed: string, salt: string): number {
  let h = 2166136261;
  const input = `${seed}:${salt}`;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function pick(seed: string, salt: string, min: number, max: number, decimals = 0): number {
  const value = min + seeded(seed, salt) * (max - min);
  return Number(value.toFixed(decimals));
}

/** Sample snapshot for a source that has no live connector yet. */
export function sampleMetrics(source: SignalSource, seed: string) {
  if (source === "github") {
    const opened = pick(seed, "gh-open", 6, 34);
    return {
      prs_opened: opened,
      prs_merged: Math.max(1, Math.round(opened * (0.6 + seeded(seed, "gh-rate") * 0.35))),
      review_comments: pick(seed, "gh-rev", 8, 120),
      avg_merge_hours: pick(seed, "gh-merge", 3, 60, 1),
      commits: pick(seed, "gh-commit", 20, 240),
      reverts: pick(seed, "gh-revert", 0, 4),
    } satisfies GithubMetrics;
  }
  if (source === "jira") {
    const assigned = pick(seed, "jira-a", 8, 40);
    return {
      tickets_assigned: assigned,
      tickets_done: Math.max(1, Math.round(assigned * (0.5 + seeded(seed, "jira-r") * 0.45))),
      story_points: pick(seed, "jira-sp", 10, 90),
      avg_cycle_days: pick(seed, "jira-cycle", 1, 12, 1),
      overdue: pick(seed, "jira-od", 0, 6),
      reopened: pick(seed, "jira-re", 0, 5),
    } satisfies JiraMetrics;
  }
  return {
    messages: pick(seed, "sl-msg", 80, 900),
    channels: pick(seed, "sl-ch", 3, 18),
    median_response_minutes: pick(seed, "sl-resp", 2, 90),
    after_hours_pct: pick(seed, "sl-ah", 2, 35),
    threads_started: pick(seed, "sl-th", 4, 60),
    helpfulness: pick(seed, "sl-help", 40, 96),
  } satisfies SlackMetrics;
}

/**
 * Real Slack-side signal we can actually observe from Keystone's own record:
 * the hire's channel, provisioning traffic and how much of it needed a human.
 */
async function liveSlackMetrics(orgId: string, hireId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: hire }, { data: activity }, { data: tasks }] = await Promise.all([
    supabaseAdmin
      .from("hires")
      .select("slack_channel_id, slack_channel_name")
      .eq("id", hireId)
      .maybeSingle(),
    supabaseAdmin
      .from("activity_log")
      .select("tool, outcome, created_at")
      .eq("org_id", orgId)
      .eq("hire_id", hireId),
    supabaseAdmin
      .from("onboarding_tasks")
      .select("system, status")
      .eq("org_id", orgId)
      .eq("hire_id", hireId),
  ]);

  const slackActivity = (activity ?? []).filter((a) => a.tool === "slack");
  if (!hire?.slack_channel_id && slackActivity.length === 0) return null;

  const afterHours = slackActivity.filter((a) => {
    const hour = new Date(a.created_at as string).getUTCHours();
    return hour < 4 || hour > 17;
  }).length;
  const slackTasks = (tasks ?? []).filter((t) => t.system === "slack");
  const done = slackTasks.filter((t) => t.status === "completed").length;

  return {
    messages: slackActivity.length,
    channels: hire?.slack_channel_id ? 2 : 1,
    median_response_minutes: 0,
    after_hours_pct:
      slackActivity.length === 0 ? 0 : Math.round((afterHours / slackActivity.length) * 100),
    threads_started: slackTasks.length,
    helpfulness: slackTasks.length === 0 ? 0 : Math.round((done / slackTasks.length) * 100),
  } satisfies SlackMetrics;
}

/**
 * Refreshes every signal for a hire. Slack comes from Keystone's own record when
 * we have one; GitHub and Jira have no connector yet, so they are stored as a
 * clearly-marked sample snapshot until real metrics are pushed in.
 */
export async function syncSignals(orgId: string, hireId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();

  const slackLive = await liveSlackMetrics(orgId, hireId);
  const rows = [
    {
      source: "slack",
      live: slackLive !== null,
      metrics: slackLive ?? sampleMetrics("slack", hireId),
    },
    { source: "github", live: false, metrics: sampleMetrics("github", hireId) },
    { source: "jira", live: false, metrics: sampleMetrics("jira", hireId) },
  ].map((r) => ({
    org_id: orgId,
    hire_id: hireId,
    source: r.source,
    live: r.live,
    metrics: r.metrics,
    captured_at: now,
    updated_at: now,
  }));

  const { error } = await supabaseAdmin
    .from("employee_signals")
    .upsert(rows, { onConflict: "hire_id,source" });
  if (error) throw new Error(error.message);
  return { ok: true, sources: rows.length, capturedAt: now };
}

/** Stores externally pushed metrics for one source, marked as live. */
export async function ingestSignal(
  orgId: string,
  hireId: string,
  source: SignalSource,
  metrics: Record<string, number>,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("employee_signals").upsert(
    {
      org_id: orgId,
      hire_id: hireId,
      source,
      live: true,
      metrics,
      captured_at: now,
      updated_at: now,
    },
    { onConflict: "hire_id,source" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

const BRIEF_SYSTEM = `You are Keystone's people-analytics analyst for an internal HR/engineering platform.
You receive one employee's profile plus activity metrics from GitHub, Slack and Jira. Some sources are marked live:false, meaning the numbers are a sample snapshot — say so rather than treating them as fact.
Reply with JSON only:
{"headline":string,"score":number,"strengths":string[],"risks":string[],"coaching":string[]}
Rules:
- headline: one sentence on how this person is trending across shipping, collaboration and delivery.
- score: 0-100 overall contribution health, grounded in the numbers you were given.
- strengths / risks / coaching: 2-3 short bullets each, each citing a concrete number.
- Never invent metrics or make claims about the person's character. Focus on work patterns, not personality.
No markdown, no preamble.`;

export type PerformanceBrief = {
  headline: string;
  score: number;
  strengths: string[];
  risks: string[];
  coaching: string[];
  cached: boolean;
  error: string | null;
};

/** AI performance read for one employee, cached until refreshed. */
export async function performanceBrief(
  orgId: string,
  hireId: string,
  force: boolean,
): Promise<PerformanceBrief> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (!force) {
    const { data } = await supabaseAdmin
      .from("performance_briefs")
      .select("headline, score, strengths, risks, coaching")
      .eq("org_id", orgId)
      .eq("hire_id", hireId)
      .maybeSingle();
    if (data) {
      return {
        headline: data.headline as string,
        score: (data.score as number) ?? 0,
        strengths: (data.strengths as string[] | null) ?? [],
        risks: (data.risks as string[] | null) ?? [],
        coaching: (data.coaching as string[] | null) ?? [],
        cached: true,
        error: null,
      };
    }
  }

  const [{ data: hire }, { data: signals }] = await Promise.all([
    supabaseAdmin
      .from("hires")
      .select("full_name, role, department, seniority, start_date")
      .eq("org_id", orgId)
      .eq("id", hireId)
      .maybeSingle(),
    supabaseAdmin
      .from("employee_signals")
      .select("source, live, metrics, captured_at")
      .eq("org_id", orgId)
      .eq("hire_id", hireId),
  ]);
  if (!hire) throw new Error("Employee not found");
  if (!signals || signals.length === 0) {
    return {
      headline: "",
      score: 0,
      strengths: [],
      risks: [],
      coaching: [],
      cached: false,
      error: "No signals captured yet — refresh signals first.",
    };
  }

  const res = await aiText([
    { role: "system", content: BRIEF_SYSTEM },
    { role: "user", content: JSON.stringify({ hire, signals }) },
  ]);
  if (!res.ok) {
    return {
      headline: "",
      score: 0,
      strengths: [],
      risks: [],
      coaching: [],
      cached: false,
      error: res.error,
    };
  }

  const parsed = parseJsonLoose<{
    headline?: string;
    score?: number;
    strengths?: string[];
    risks?: string[];
    coaching?: string[];
  }>(res.text);

  const clip = (list: string[] | undefined) =>
    (list ?? []).slice(0, 3).map((s) => String(s).slice(0, 240));
  const brief = {
    headline: parsed?.headline?.trim() || res.text.slice(0, 400),
    score:
      typeof parsed?.score === "number" ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0,
    strengths: clip(parsed?.strengths),
    risks: clip(parsed?.risks),
    coaching: clip(parsed?.coaching),
  };

  await supabaseAdmin.from("performance_briefs").upsert(
    {
      org_id: orgId,
      hire_id: hireId,
      ...brief,
      model: "google/gemini-2.5-flash",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "hire_id" },
  );

  return { ...brief, cached: false, error: null };
}
