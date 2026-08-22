import { createHmac } from "node:crypto";

import { loadOrgById } from "./org-ops.server";

export type FlowTriggerResult = {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  error?: string;
  detail?: string;
};

/**
 * Fires the organization's automation flow (viaSocket "catch hook") with the
 * newly created hire. Signed with the org's own webhook secret so the flow can
 * verify the call came from this app.
 */
export async function triggerHireFlow(
  orgId: string,
  hireId: string,
  appOrigin: string,
): Promise<FlowTriggerResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const org = await loadOrgById(orgId);
  if (!org) return { ok: false, error: "Organization not found" };

  const url = org.flow_trigger_url;
  if (!url) {
    return {
      ok: false,
      skipped: true,
      error: "No flow trigger URL is set for this organization (Wiring → Flow trigger URL).",
    };
  }

  const { data: hire, error: hireError } = await supabaseAdmin
    .from("hires")
    .select(
      "id, external_id, full_name, email, role, department, seniority, employment_type, location, start_date, pii_access, on_call, direct_reports, owning_team, slack_channel_name",
    )
    .eq("org_id", orgId)
    .eq("id", hireId)
    .maybeSingle();
  if (hireError || !hire) return { ok: false, error: hireError?.message ?? "Hire not found" };

  const origin = appOrigin.replace(/\/$/, "");
  const payload = {
    event: "hire.created",
    org: { id: org.id, slug: org.slug, name: org.name },
    hire: {
      id: hire.id,
      external_id: hire.external_id,
      full_name: hire.full_name,
      email: hire.email,
      role: hire.role,
      department: hire.department,
      seniority: hire.seniority,
      employment_type: hire.employment_type,
      location: hire.location,
      start_date: hire.start_date,
      pii_access: hire.pii_access,
      on_call: hire.on_call,
      direct_reports: hire.direct_reports,
      owning_team: hire.owning_team,
    },
    slack: { channel_name: hire.slack_channel_name },
    callbacks: {
      task_url: `${origin}/api/public/viasocket/${org.slug}/task`,
      hire_url: `${origin}/api/public/viasocket/${org.slug}/hire`,
    },
  };

  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", org.webhook_secret).update(body).digest("hex");

  let result: FlowTriggerResult;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-onboard-signature": `sha256=${signature}`,
        "x-onboard-event": "hire.created",
      },
      body,
    });
    const text = await res.text();
    result = res.ok
      ? { ok: true, status: res.status, detail: text.slice(0, 500) }
      : { ok: false, status: res.status, error: `[${res.status}] ${text.slice(0, 400)}` };
    if (!res.ok) console.error(`flow trigger failed [${res.status}]: ${text}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("flow trigger threw", detail);
    result = { ok: false, error: detail };
  }

  await supabaseAdmin
    .from("hires")
    .update({
      flow_triggered_at: result.ok ? new Date().toISOString() : null,
      flow_trigger_error: result.ok ? null : (result.error ?? "Flow trigger failed"),
    })
    .eq("id", hireId);

  return result;
}
