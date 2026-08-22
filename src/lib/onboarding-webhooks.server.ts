import { z } from "zod";

import { notifyApprovalNeeded, notifyFailure, type TaskRow } from "./decisions.server";
import { getSingleOrg, verifyOrgSignature } from "./org-ops.server";

const hireSchema = z.object({
  external_id: z.string().min(1).max(200),
  full_name: z.string().min(1).max(200),
  email: z.string().email().max(320).optional().nullable(),
  role: z.string().min(1).max(200),
  department: z.string().min(1).max(200),
  seniority: z.string().max(100).optional().nullable(),
  employment_type: z.string().max(100).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  start_date: z.string().max(40).optional().nullable(),
  pii_access: z.boolean().optional(),
  on_call: z.boolean().optional(),
  direct_reports: z.boolean().optional(),
  owning_team: z.string().max(200).optional().nullable(),
});

const taskSchema = z.object({
  hire_external_id: z.string().min(1).max(200),
  external_task_id: z.string().max(200).optional().nullable(),
  system: z.string().min(1).max(200),
  action: z.string().min(1).max(200),
  reason: z.string().max(2000).optional().nullable(),
  confidence: z.number().min(0).max(1).optional().nullable(),
  sensitive: z.boolean().optional(),
  status: z.enum(["not_started", "in_progress", "completed", "failed", "needs_human"]),
  retry_count: z.number().int().min(0).max(100).optional(),
  error_message: z.string().max(4000).optional().nullable(),
  raw_response: z.string().max(20000).optional().nullable(),
});

/** Reads the raw body, resolves the single org, and verifies the HMAC signature. */
async function authorize(request: Request) {
  const raw = await request.text();
  const org = await getSingleOrg();
  if (!org) {
    return { error: Response.json({ error: "workspace not configured" }, { status: 503 }) } as const;
  }
  if (!verifyOrgSignature(raw, request.headers.get("x-viasocket-signature"), org.webhook_secret)) {
    return { error: Response.json({ error: "invalid signature" }, { status: 401 }) } as const;
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { error: Response.json({ error: "invalid JSON" }, { status: 400 }) } as const;
  }
  return { org, body } as const;
}

export async function handleHireWebhook(request: Request): Promise<Response> {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;

  const parsed = hireSchema.safeParse(auth.body);
  if (!parsed.success) {
    return Response.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const hire = parsed.data;
  const org = auth.org;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("hires")
    .upsert(
      {
        org_id: org.id,
        external_id: hire.external_id,
        full_name: hire.full_name,
        email: hire.email ?? null,
        role: hire.role,
        department: hire.department,
        seniority: hire.seniority ?? null,
        employment_type: hire.employment_type ?? null,
        location: hire.location ?? null,
        start_date: hire.start_date ?? null,
        pii_access: hire.pii_access ?? false,
        on_call: hire.on_call ?? false,
        direct_reports: hire.direct_reports ?? false,
        owning_team: hire.owning_team ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,external_id" },
    )
    .select("id")
    .single();

  if (error) {
    console.error("hire upsert failed", error);
    return Response.json({ error: "could not store hire" }, { status: 500 });
  }

  // Provisioning (Slack channels included) is owned by the automation flow.
  return Response.json({ ok: true, hire_id: data.id });
}

export async function handleTaskWebhook(request: Request): Promise<Response> {
  const auth = await authorize(request);
  if ("error" in auth) return auth.error;

  const parsed = taskSchema.safeParse(auth.body);
  if (!parsed.success) {
    return Response.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const t = parsed.data;
  const org = auth.org;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: hire, error: hireError } = await supabaseAdmin
    .from("hires")
    .select("id, full_name, owning_team")
    .eq("org_id", org.id)
    .eq("external_id", t.hire_external_id)
    .maybeSingle();
  if (hireError) {
    console.error("hire lookup failed", hireError);
    return Response.json({ error: "hire lookup failed" }, { status: 500 });
  }
  if (!hire) return Response.json({ error: "unknown hire_external_id" }, { status: 404 });

  const { data: previous } = await supabaseAdmin
    .from("onboarding_tasks")
    .select("status")
    .eq("hire_id", hire.id)
    .eq("system", t.system)
    .eq("action", t.action)
    .maybeSingle();

  const { data: task, error } = await supabaseAdmin
    .from("onboarding_tasks")
    .upsert(
      {
        org_id: org.id,
        hire_id: hire.id,
        external_task_id: t.external_task_id ?? null,
        system: t.system,
        action: t.action,
        reason: t.reason ?? null,
        confidence: t.confidence ?? null,
        sensitive: t.sensitive ?? false,
        status: t.status,
        retry_count: t.retry_count ?? 0,
        error_message: t.error_message ?? null,
        raw_response: t.raw_response ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "hire_id,system,action" },
    )
    .select(
      "id, org_id, hire_id, system, action, reason, confidence, status, retry_count, error_message, raw_response, external_task_id",
    )
    .single();

  if (error || !task) {
    console.error("task upsert failed", error);
    return Response.json({ error: "could not store task" }, { status: 500 });
  }

  const row = task as TaskRow;
  const appUrl = new URL(request.url).origin;
  try {
    if (row.status === "needs_human" && previous?.status !== "needs_human") {
      await notifyApprovalNeeded(org, row, hire.full_name, appUrl);
    }
    if (row.status === "failed" && previous?.status !== "failed") {
      await notifyFailure(org, row, hire.full_name, hire.owning_team);
    }
  } catch (notifyError) {
    console.error("notification failed", notifyError);
  }

  return Response.json({ ok: true, task_id: row.id });
}
