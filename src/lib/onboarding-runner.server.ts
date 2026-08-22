import { notifyApprovalNeeded, notifyFailure, type TaskRow } from "./decisions.server";
import { sendMailForOrg, welcomeEmail } from "./gmail.server";
import { loadOrgById, type OrgRow } from "./org-ops.server";
import { grantSlackAccess } from "./slack-access.server";
import { ensureHireChannel } from "./slack-channels.server";

export type RunResult = {
  ok: boolean;
  created: number;
  completed: number;
  failed: number;
  needsApproval: number;
  errors: string[];
};

type HireRecord = {
  id: string;
  org_id: string;
  full_name: string;
  email: string | null;
  role: string;
  department: string;
  start_date: string | null;
  owning_team: string | null;
  pii_access: boolean;
  on_call: boolean;
  direct_reports: boolean;
  slack_channel_id: string | null;
  slack_channel_name: string | null;
};

type PlannedTask = {
  system: string;
  action: string;
  reason: string;
  confidence: number;
  sensitive: boolean;
};

/** Deterministic onboarding plan derived from the hire's own attributes. */
export function planTasks(hire: HireRecord): PlannedTask[] {
  const plan: PlannedTask[] = [
    {
      system: "slack",
      action: "create_onboarding_channel",
      reason: `Dedicated onboarding channel for ${hire.full_name}`,
      confidence: 0.99,
      sensitive: false,
    },
    {
      system: "slack",
      action: "invite_to_workspace",
      reason: `Invite ${hire.full_name} to the Slack workspace`,
      confidence: 0.9,
      sensitive: false,
    },
    {
      system: "slack",
      action: "grant_channel_access",
      reason: `Add ${hire.full_name} to the shared and onboarding channels`,
      confidence: 0.95,
      sensitive: false,
    },
    {
      system: "google_mail",
      action: "send_welcome_email",
      reason: "Welcome email with first-day details",
      confidence: 0.98,
      sensitive: false,
    },
    {
      system: "it",
      action: "prepare_equipment",
      reason: `Laptop and peripherals for ${hire.role}`,
      confidence: 0.8,
      sensitive: false,
    },
    {
      system: "hr",
      action: "collect_documents",
      reason: "Contract, ID and payroll paperwork",
      confidence: 0.85,
      sensitive: false,
    },
  ];

  if (hire.pii_access) {
    plan.push({
      system: "identity",
      action: "grant_pii_access_group",
      reason: "Role is flagged for access to personal data — needs a human sign-off",
      confidence: 0.6,
      sensitive: true,
    });
  }
  if (hire.on_call) {
    plan.push({
      system: "paging",
      action: "add_to_on_call_rotation",
      reason: "Role is on-call — rotation changes need a human sign-off",
      confidence: 0.65,
      sensitive: true,
    });
  }
  if (hire.direct_reports) {
    plan.push({
      system: "hr",
      action: "grant_manager_permissions",
      reason: "Hire has direct reports — manager permissions need a human sign-off",
      confidence: 0.6,
      sensitive: true,
    });
  }
  return plan;
}

async function loadHire(orgId: string, hireId: string): Promise<HireRecord | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("hires")
    .select(
      "id, org_id, full_name, email, role, department, start_date, owning_team, pii_access, on_call, direct_reports, slack_channel_id, slack_channel_name",
    )
    .eq("org_id", orgId)
    .eq("id", hireId)
    .maybeSingle();
  if (error) throw error;
  return (data as HireRecord | null) ?? null;
}

async function upsertTask(
  hire: HireRecord,
  planned: PlannedTask,
  patch: Partial<{
    status: "not_started" | "in_progress" | "completed" | "failed" | "needs_human";
    error_message: string | null;
    raw_response: string | null;
    retry_count: number;
  }>,
): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("onboarding_tasks")
    .select("id")
    .eq("org_id", hire.org_id)
    .eq("hire_id", hire.id)
    .eq("system", planned.system)
    .eq("action", planned.action)
    .maybeSingle();

  const row = {
    org_id: hire.org_id,
    hire_id: hire.id,
    system: planned.system,
    action: planned.action,
    reason: planned.reason,
    confidence: planned.confidence,
    sensitive: planned.sensitive,
    updated_at: new Date().toISOString(),
    ...patch,
  };

  if (existing?.id) {
    await supabaseAdmin.from("onboarding_tasks").update(row).eq("id", existing.id);
    return existing.id as string;
  }
  const { data, error } = await supabaseAdmin
    .from("onboarding_tasks")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function taskRowFor(taskId: string): Promise<TaskRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("onboarding_tasks")
    .select(
      "id, org_id, hire_id, system, action, reason, confidence, status, retry_count, error_message, raw_response, external_task_id",
    )
    .eq("id", taskId)
    .maybeSingle();
  return (data as TaskRow | null) ?? null;
}

/**
 * Runs the whole onboarding for one hire directly from this app using the
 * organization's own connected tools (Slack, Gmail). Sensitive steps are parked
 * as `needs_human` and announced in Slack so they can be approved here or there.
 */
export async function runOnboarding(
  orgId: string,
  hireId: string,
  appOrigin: string,
): Promise<RunResult> {
  const result: RunResult = {
    ok: true,
    created: 0,
    completed: 0,
    failed: 0,
    needsApproval: 0,
    errors: [],
  };

  const org: OrgRow | null = await loadOrgById(orgId);
  if (!org) throw new Error("Organization not found");
  let hire = await loadHire(orgId, hireId);
  if (!hire) throw new Error("Hire not found");

  const plan = planTasks(hire);
  result.created = plan.length;

  for (const planned of plan) {
    // Sensitive work waits for a person, in-app or in Slack.
    if (planned.sensitive) {
      const taskId = await upsertTask(hire, planned, {
        status: "needs_human",
        error_message: null,
      });
      result.needsApproval += 1;
      const row = await taskRowFor(taskId);
      if (row) await notifyApprovalNeeded(org, row, hire.full_name, appOrigin);
      continue;
    }

    if (planned.system === "slack" && planned.action === "create_onboarding_channel") {
      await upsertTask(hire, planned, { status: "in_progress", error_message: null });
      const channel = await ensureHireChannel(orgId, hireId);
      // ensureHireChannel records its own task row; refresh the hire for the channel id.
      hire = (await loadHire(orgId, hireId)) ?? hire;
      if (channel.ok) result.completed += 1;
      else {
        result.failed += 1;
        result.ok = false;
        if (channel.error) result.errors.push(channel.error);
      }
      continue;
    }

    if (planned.system === "slack" && planned.action === "grant_channel_access") {
      await upsertTask(hire, planned, { status: "in_progress", error_message: null });
      const access = await grantSlackAccess(orgId, hireId);
      if (access.ok) result.completed += 1;
      else {
        result.failed += 1;
        result.ok = false;
        if (access.error) result.errors.push(access.error);
      }
      continue;
    }

    if (planned.system === "google_mail") {
      const taskId = await upsertTask(hire, planned, {
        status: "in_progress",
        error_message: null,
      });
      if (!hire.email) {
        await upsertTask(hire, planned, {
          status: "failed",
          error_message: "This hire has no email address.",
        });
        result.failed += 1;
        result.ok = false;
        continue;
      }
      const mail = welcomeEmail({
        fullName: hire.full_name,
        role: hire.role,
        department: hire.department,
        startDate: hire.start_date,
        orgName: org.name,
        slackChannel: hire.slack_channel_name,
      });
      const sent = await sendMailForOrg(orgId, hire.email, mail.subject, mail.html);
      await upsertTask(hire, planned, {
        status: sent.ok ? "completed" : "failed",
        error_message: sent.ok ? null : (sent.error ?? "Gmail send failed"),
        raw_response: sent.raw.slice(0, 4000),
      });
      if (sent.ok) result.completed += 1;
      else {
        result.failed += 1;
        result.ok = false;
        result.errors.push(sent.raw.slice(0, 200));
        const row = await taskRowFor(taskId);
        if (row) await notifyFailure(org, row, hire.full_name, hire.owning_team);
      }
      continue;
    }

    // Manual checklist steps: tracked here, ticked off by a human.
    await upsertTask(hire, planned, { status: "not_started", error_message: null });
  }

  return result;
}

/** Runs one already-approved task. Used after an approval lands (app or Slack). */
export async function executeApprovedTask(taskId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const task = await taskRowFor(taskId);
  if (!task) return;
  const hire = await loadHire(task.org_id, task.hire_id);

  // Approved sensitive steps are carried out by the owning team; the app records
  // the sign-off and closes the task so the dashboard reflects reality.
  await supabaseAdmin
    .from("onboarding_tasks")
    .update({
      status: "completed",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  const org = await loadOrgById(task.org_id);
  if (org && hire && org.slack_approval_channel) {
    const { slackCallForOrg } = await import("./org-ops.server");
    await slackCallForOrg(org.id, "chat.postMessage", {
      channel: hire.slack_channel_id ?? org.slack_approval_channel,
      text: `:white_check_mark: ${task.system} · ${task.action} approved and marked done for ${hire.full_name}.`,
    });
  }
}
