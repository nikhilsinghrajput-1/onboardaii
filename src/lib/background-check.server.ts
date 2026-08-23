import { aiText, parseJsonLoose } from "./ai.server";

/** Categories Keystone verifies for every hire. */
export const CLAIM_CATEGORIES = [
  "identity",
  "employment",
  "education",
  "certification",
  "reference",
  "criminal",
  "online",
] as const;

export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number];
export type Verdict = "pending" | "verified" | "unverified" | "discrepancy";

export type Claim = {
  id: string;
  category: string;
  claim: string;
  evidence: string | null;
  verdict: Verdict;
  finding: string | null;
  confidence: number | null;
  updated_at: string;
};

export type CheckRecord = {
  id: string;
  hire_id: string;
  status: "draft" | "running" | "review" | "cleared" | "flagged";
  risk_score: number;
  summary: string | null;
  ai_error: string | null;
  completed_at: string | null;
  updated_at: string;
};

const RISK_WEIGHT: Record<Verdict, number> = {
  discrepancy: 34,
  unverified: 12,
  pending: 6,
  verified: 0,
};

function rollup(claims: { verdict: string }[]) {
  const score = Math.min(
    100,
    claims.reduce((sum, c) => sum + (RISK_WEIGHT[c.verdict as Verdict] ?? 6), 0),
  );
  const hasDiscrepancy = claims.some((c) => c.verdict === "discrepancy");
  const allDecided = claims.length > 0 && claims.every((c) => c.verdict !== "pending");
  const status: CheckRecord["status"] = hasDiscrepancy
    ? "flagged"
    : allDecided
      ? "cleared"
      : "review";
  return { score, status };
}

async function log(
  orgId: string,
  hireId: string,
  action: string,
  outcome: string,
  detail: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("activity_log").insert({
    org_id: orgId,
    hire_id: hireId,
    tool: "background_check",
    action,
    outcome,
    detail: detail.slice(0, 500),
  });
}

/** Seed rows a fresh check starts from, derived from what the hire told us. */
function seedClaims(hire: {
  full_name: string;
  email: string | null;
  role: string;
  department: string;
}) {
  return [
    {
      category: "identity",
      claim: `Legal name "${hire.full_name}" matches government ID and work email ${hire.email ?? "(none on file)"}.`,
      evidence: null,
    },
    {
      category: "employment",
      claim: `Most recent employment history supports the ${hire.role} role in ${hire.department}.`,
      evidence: null,
    },
    {
      category: "education",
      claim: "Highest degree and graduation year as stated on the resume.",
      evidence: null,
    },
    {
      category: "certification",
      claim: "Certifications or licences claimed for this role are current.",
      evidence: null,
    },
    {
      category: "reference",
      claim: "At least one professional reference confirms scope and dates.",
      evidence: null,
    },
    {
      category: "criminal",
      claim: "No adverse criminal record relevant to this role in the hiring jurisdiction.",
      evidence: null,
    },
    {
      category: "online",
      claim: "Public professional profiles are consistent with the resume timeline.",
      evidence: null,
    },
  ];
}

/** Creates the check (and its seed claims) for a hire if it does not exist yet. */
export async function ensureCheck(orgId: string, hireId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("background_checks")
    .select("id")
    .eq("org_id", orgId)
    .eq("hire_id", hireId)
    .maybeSingle();
  if (existing) return { checkId: existing.id as string, created: false };

  const { data: hire } = await supabaseAdmin
    .from("hires")
    .select("full_name, email, role, department")
    .eq("org_id", orgId)
    .eq("id", hireId)
    .maybeSingle();
  if (!hire) throw new Error("Hire not found");

  const { data: check, error } = await supabaseAdmin
    .from("background_checks")
    .insert({ org_id: orgId, hire_id: hireId, status: "draft", requested_by: userId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const rows = seedClaims({
    full_name: hire.full_name as string,
    email: (hire.email as string | null) ?? null,
    role: hire.role as string,
    department: hire.department as string,
  }).map((c) => ({ ...c, org_id: orgId, check_id: check.id as string }));
  await supabaseAdmin.from("background_check_claims").insert(rows);

  await log(orgId, hireId, "check.opened", "ok", `Background check opened for ${hire.full_name}`);
  return { checkId: check.id as string, created: true };
}

const VERIFY_SYSTEM = `You are Keystone's background-verification analyst for an internal HR platform.
You receive a hire profile and a list of resume claims, each with the evidence the recruiter has attached (may be empty).
Reply with JSON only:
{"claims":[{"id":string,"verdict":"verified"|"unverified"|"discrepancy","finding":string,"confidence":number}],"summary":string}
Rules:
- "verified" only when the attached evidence plausibly substantiates the claim.
- "unverified" when there is no usable evidence yet — say exactly what document or check is missing.
- "discrepancy" when the evidence contradicts the claim (dates, titles, employer, degree, identity).
- Never invent employers, dates, records or sources. Do not claim to have queried any external database.
- finding: at most 2 sentences aimed at an HR reviewer. confidence: 0 to 1.
- summary: at most 3 sentences on whether this hire is safe to onboard and what a human must still do.
No markdown, no preamble.`;

/** Runs the AI review over all claims on a check and stores verdicts. */
export async function verifyCheck(orgId: string, checkId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: check } = await supabaseAdmin
    .from("background_checks")
    .select("id, hire_id")
    .eq("org_id", orgId)
    .eq("id", checkId)
    .maybeSingle();
  if (!check) throw new Error("Background check not found");

  const [{ data: hire }, { data: claims }] = await Promise.all([
    supabaseAdmin
      .from("hires")
      .select("full_name, role, department, seniority, location, start_date, pii_access")
      .eq("id", check.hire_id as string)
      .maybeSingle(),
    supabaseAdmin
      .from("background_check_claims")
      .select("id, category, claim, evidence")
      .eq("check_id", checkId)
      .order("created_at", { ascending: true }),
  ]);

  if (!claims || claims.length === 0) throw new Error("Add at least one claim first");

  await supabaseAdmin
    .from("background_checks")
    .update({ status: "running", ai_error: null, updated_at: new Date().toISOString() })
    .eq("id", checkId);

  const res = await aiText([
    { role: "system", content: VERIFY_SYSTEM },
    { role: "user", content: JSON.stringify({ hire, claims }) },
  ]);

  if (!res.ok) {
    await supabaseAdmin
      .from("background_checks")
      .update({ status: "review", ai_error: res.error, updated_at: new Date().toISOString() })
      .eq("id", checkId);
    await log(orgId, check.hire_id as string, "check.verify", "failed", res.error ?? "AI failed");
    return { ok: false, error: res.error };
  }

  const parsed = parseJsonLoose<{
    claims?: { id?: string; verdict?: string; finding?: string; confidence?: number }[];
    summary?: string;
  }>(res.text);

  const allowed = new Set(["verified", "unverified", "discrepancy"]);
  const byId = new Map(claims.map((c) => [c.id as string, c]));
  for (const item of parsed?.claims ?? []) {
    const id = String(item.id ?? "");
    if (!byId.has(id)) continue;
    const verdict = allowed.has(String(item.verdict)) ? String(item.verdict) : "unverified";
    await supabaseAdmin
      .from("background_check_claims")
      .update({
        verdict,
        finding: String(item.finding ?? "").slice(0, 600) || null,
        confidence:
          typeof item.confidence === "number" ? Math.max(0, Math.min(1, item.confidence)) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("org_id", orgId);
  }

  const { data: fresh } = await supabaseAdmin
    .from("background_check_claims")
    .select("verdict")
    .eq("check_id", checkId);
  const { score, status } = rollup(fresh ?? []);

  await supabaseAdmin
    .from("background_checks")
    .update({
      status,
      risk_score: score,
      summary: (parsed?.summary ?? res.text).slice(0, 1200),
      ai_error: null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", checkId);

  await log(
    orgId,
    check.hire_id as string,
    "check.verify",
    status === "flagged" ? "failed" : "ok",
    `Verification finished — ${status}, risk ${score}`,
  );

  return { ok: true, status, riskScore: score, error: null };
}

/** Human override on one claim; recomputes the rollup. */
export async function decideClaim(
  orgId: string,
  claimId: string,
  verdict: Verdict,
  finding: string | null,
  userId: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: claim } = await supabaseAdmin
    .from("background_check_claims")
    .select("id, check_id")
    .eq("org_id", orgId)
    .eq("id", claimId)
    .maybeSingle();
  if (!claim) throw new Error("Claim not found");

  await supabaseAdmin
    .from("background_check_claims")
    .update({
      verdict,
      finding: finding?.slice(0, 600) ?? null,
      decided_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", claimId);

  const { data: fresh } = await supabaseAdmin
    .from("background_check_claims")
    .select("verdict")
    .eq("check_id", claim.check_id as string);
  const { score, status } = rollup(fresh ?? []);
  await supabaseAdmin
    .from("background_checks")
    .update({ risk_score: score, status, updated_at: new Date().toISOString() })
    .eq("id", claim.check_id as string);

  return { ok: true, status, riskScore: score };
}

/** Adds a recruiter-supplied claim (or evidence) to an open check. */
export async function addClaim(
  orgId: string,
  checkId: string,
  category: string,
  claim: string,
  evidence: string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("background_check_claims").insert({
    org_id: orgId,
    check_id: checkId,
    category,
    claim,
    evidence,
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Attaches or replaces the evidence text on one claim. */
export async function setEvidence(orgId: string, claimId: string, evidence: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("background_check_claims")
    .update({ evidence, verdict: "pending", updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", claimId);
  if (error) throw new Error(error.message);
  return { ok: true };
}
