const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * One completion from the Lovable AI Gateway. Returns plain text and never throws,
 * so an AI hiccup degrades the panel instead of breaking the page.
 */
export async function aiText(
  messages: ChatMessage[],
): Promise<{ ok: boolean; text: string; error: string | null }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { ok: false, text: "", error: "AI is not configured for this app." };
  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.3 }),
    });
    const raw = await res.text();
    if (!res.ok) {
      console.error(`Lovable AI failed [${res.status}]: ${raw}`);
      if (res.status === 429) return { ok: false, text: "", error: "AI rate limit reached — try again shortly." };
      if (res.status === 402) return { ok: false, text: "", error: "AI credits exhausted." };
      return { ok: false, text: "", error: `AI request failed (${res.status}).` };
    }
    const parsed = JSON.parse(raw) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = parsed.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, text: "", error: "The model returned nothing." };
    return { ok: true, text, error: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`Lovable AI threw: ${detail}`);
    return { ok: false, text: "", error: "Could not reach the AI service." };
  }
}

/** Best-effort JSON extraction from a model reply. */
export function parseJsonLoose<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.search(/[[{]/);
  if (start < 0) return null;
  try {
    return JSON.parse(candidate.slice(start)) as T;
  } catch {
    return null;
  }
}

type Snapshot = {
  orgName: string;
  hires: {
    name: string;
    role: string;
    department: string;
    startDate: string | null;
    tasks: { system: string; action: string; status: string; error: string | null }[];
  }[];
};

/** Compact, model-friendly view of the current onboarding state. */
export async function onboardingSnapshot(orgId: string, orgName: string): Promise<Snapshot> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: hires }, { data: tasks }] = await Promise.all([
    supabaseAdmin
      .from("hires")
      .select("id, full_name, role, department, start_date")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabaseAdmin
      .from("onboarding_tasks")
      .select("hire_id, system, action, status, error_message")
      .eq("org_id", orgId)
      .limit(400),
  ]);

  return {
    orgName,
    hires: (hires ?? []).map((h) => ({
      name: h.full_name as string,
      role: h.role as string,
      department: h.department as string,
      startDate: (h.start_date as string | null) ?? null,
      tasks: (tasks ?? [])
        .filter((t) => t.hire_id === h.id)
        .map((t) => ({
          system: t.system as string,
          action: t.action as string,
          status: t.status as string,
          error: (t.error_message as string | null) ?? null,
        })),
    })),
  };
}

export type Briefing = {
  summary: string;
  nextActions: string[];
  date: string;
  cached: boolean;
  error: string | null;
};

const BRIEFING_SYSTEM =
  "You are Keystone, the onboarding operations copilot for an internal HR/IT tool. You are given a JSON snapshot of new hires and their provisioning tasks. Reply with JSON only: {\"summary\": string, \"nextActions\": string[]}. summary is at most 3 sentences of plain English about what is blocked, what is on track, and what needs a human. nextActions is 2 to 4 short imperative bullets naming the hire and the tool. No markdown, no preamble.";

/** Today's briefing, generated once per day and cached in the database. */
export async function dailyBriefing(
  orgId: string,
  orgName: string,
  force: boolean,
): Promise<Briefing> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const today = new Date().toISOString().slice(0, 10);

  if (!force) {
    const { data } = await supabaseAdmin
      .from("ai_briefings")
      .select("summary, next_actions, briefing_date")
      .eq("org_id", orgId)
      .eq("briefing_date", today)
      .maybeSingle();
    if (data) {
      return {
        summary: data.summary as string,
        nextActions: (data.next_actions as string[] | null) ?? [],
        date: today,
        cached: true,
        error: null,
      };
    }
  }

  const snapshot = await onboardingSnapshot(orgId, orgName);
  if (snapshot.hires.length === 0) {
    return {
      summary: `No hires are in flight for ${orgName} right now. Add a hire and Keystone will provision Slack, email, calendar, drive and docs automatically.`,
      nextActions: [],
      date: today,
      cached: false,
      error: null,
    };
  }

  const res = await aiText([
    { role: "system", content: BRIEFING_SYSTEM },
    { role: "user", content: JSON.stringify(snapshot) },
  ]);
  if (!res.ok) {
    return { summary: "", nextActions: [], date: today, cached: false, error: res.error };
  }

  const parsed = parseJsonLoose<{ summary?: string; nextActions?: string[] }>(res.text);
  const summary = parsed?.summary?.trim() || res.text.slice(0, 900);
  const nextActions = (parsed?.nextActions ?? []).slice(0, 4).map((a) => String(a).slice(0, 240));

  await supabaseAdmin.from("ai_briefings").upsert(
    {
      org_id: orgId,
      briefing_date: today,
      summary,
      next_actions: nextActions,
      model: "google/gemini-2.5-flash",
      created_at: new Date().toISOString(),
    },
    { onConflict: "org_id,briefing_date" },
  );

  return { summary, nextActions, date: today, cached: false, error: null };
}

export type ApprovalAdvice = {
  risk: "low" | "medium" | "high";
  recommendation: "approve" | "reject" | "ask";
  reasoning: string;
  error: string | null;
};

/** Plain-language risk read on one pending approval. */
export async function approvalAdvice(input: {
  hireName: string;
  role: string;
  department: string;
  system: string;
  action: string;
  reason: string | null;
  confidence: number | null;
  piiAccess: boolean;
  onCall: boolean;
  directReports: boolean;
}): Promise<ApprovalAdvice> {
  const res = await aiText([
    {
      role: "system",
      content:
        'You review access-provisioning approvals for an internal onboarding tool. Reply with JSON only: {"risk":"low"|"medium"|"high","recommendation":"approve"|"reject"|"ask","reasoning":string}. reasoning is at most 2 sentences of plain English aimed at an HR or IT reviewer, naming the concrete risk and what to check. A human always makes the final call.',
    },
    { role: "user", content: JSON.stringify(input) },
  ]);
  if (!res.ok) {
    return { risk: "medium", recommendation: "ask", reasoning: "", error: res.error };
  }
  const parsed = parseJsonLoose<ApprovalAdvice>(res.text);
  return {
    risk: parsed?.risk === "low" || parsed?.risk === "high" ? parsed.risk : "medium",
    recommendation:
      parsed?.recommendation === "approve" || parsed?.recommendation === "reject"
        ? parsed.recommendation
        : "ask",
    reasoning: parsed?.reasoning?.trim() || res.text.slice(0, 400),
    error: null,
  };
}

/** Answers a question about the live onboarding data. */
export async function askKeystoneAnswer(
  orgId: string,
  orgName: string,
  question: string,
): Promise<{ answer: string; error: string | null }> {
  const snapshot = await onboardingSnapshot(orgId, orgName);
  const res = await aiText([
    {
      role: "system",
      content:
        "You are Keystone, the onboarding copilot for an internal tool. Answer only from the JSON data provided. Be concise and concrete: name hires, tools and task states. If the data does not contain the answer, say so plainly. Never invent hires or statuses. Plain text, short paragraphs or dashes for lists.",
    },
    { role: "user", content: `Data:\n${JSON.stringify(snapshot)}\n\nQuestion: ${question}` },
  ]);
  if (!res.ok) return { answer: "", error: res.error };
  return { answer: res.text, error: null };
}

/** AI-proposed checklist for one hire, alongside the deterministic plan. */
export async function proposedPlan(input: {
  fullName: string;
  role: string;
  department: string;
  seniority: string | null;
  piiAccess: boolean;
  onCall: boolean;
  directReports: boolean;
  connectedTools: string[];
}): Promise<{ items: { title: string; tool: string; why: string }[]; error: string | null }> {
  const res = await aiText([
    {
      role: "system",
      content:
        'You plan onboarding checklists. Reply with JSON only: {"items":[{"title":string,"tool":string,"why":string}]}. Use at most 6 items, only tools from connectedTools plus "hr" or "it", each title a short imperative task. No markdown.',
    },
    { role: "user", content: JSON.stringify(input) },
  ]);
  if (!res.ok) return { items: [], error: res.error };
  const parsed = parseJsonLoose<{ items?: { title?: string; tool?: string; why?: string }[] }>(
    res.text,
  );
  const items = (parsed?.items ?? []).slice(0, 6).map((i) => ({
    title: String(i.title ?? "").slice(0, 160),
    tool: String(i.tool ?? "hr").slice(0, 40),
    why: String(i.why ?? "").slice(0, 240),
  }));
  return { items: items.filter((i) => i.title), error: items.length ? null : "No plan returned." };
}
