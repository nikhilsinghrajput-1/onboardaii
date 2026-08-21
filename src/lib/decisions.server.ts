import { alertChannel, approvalChannel, resumeViaSocket, slackCall } from "./ops.server";

export type Decision = "approved" | "rejected";

export type TaskRow = {
  id: string;
  hire_id: string;
  system: string;
  action: string;
  reason: string | null;
  confidence: number | null;
  status: string;
  retry_count: number;
  error_message: string | null;
  raw_response: string | null;
  external_task_id: string | null;
};

export async function applyDecision(input: {
  taskId: string;
  decision: Decision;
  note: string;
  decidedBy?: string | null;
  decidedByLabel: string;
  channel: "in_app" | "slack";
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: task, error: taskError } = await supabaseAdmin
    .from("onboarding_tasks")
    .select("id, hire_id, system, action, external_task_id, status")
    .eq("id", input.taskId)
    .maybeSingle();
  if (taskError) throw taskError;
  if (!task) throw new Error("Task not found");
  if (task.status !== "needs_human") {
    return { ok: false as const, message: "This task no longer needs a decision." };
  }

  const { error: approvalError } = await supabaseAdmin.from("approvals").insert({
    task_id: task.id,
    decision: input.decision,
    note: input.note,
    decided_by: input.decidedBy ?? null,
    decided_by_label: input.decidedByLabel,
    channel: input.channel,
  });
  if (approvalError) throw approvalError;

  const nextStatus = input.decision === "approved" ? "in_progress" : "failed";
  const { error: updateError } = await supabaseAdmin
    .from("onboarding_tasks")
    .update({
      status: nextStatus,
      error_message:
        input.decision === "rejected" ? `Rejected by ${input.decidedByLabel}: ${input.note}` : null,
    })
    .eq("id", task.id);
  if (updateError) throw updateError;

  const { data: hire } = await supabaseAdmin
    .from("hires")
    .select("full_name, external_id")
    .eq("id", task.hire_id)
    .maybeSingle();

  const resume = await resumeViaSocket({
    event: "approval_decision",
    task_id: task.id,
    external_task_id: task.external_task_id,
    hire_id: task.hire_id,
    hire_external_id: hire?.external_id ?? null,
    system: task.system,
    action: task.action,
    decision: input.decision,
    note: input.note,
    decided_by: input.decidedByLabel,
  });

  const channel = approvalChannel();
  if (channel) {
    await slackCall("chat.postMessage", {
      channel,
      text: `${input.decision === "approved" ? ":white_check_mark: Approved" : ":no_entry: Rejected"} — ${
        hire?.full_name ?? "hire"
      } · ${task.system} · ${task.action}\n_by ${input.decidedByLabel}_ — ${input.note}`,
    });
  }

  return { ok: true as const, resumed: resume.ok, resumeDetail: resume.detail };
}

export async function notifyApprovalNeeded(task: TaskRow, hireName: string, appUrl: string) {
  const channel = approvalChannel();
  if (!channel) return;
  await slackCall("chat.postMessage", {
    channel,
    text: `Approval needed: ${hireName} · ${task.system} · ${task.action}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Approval needed* for *${hireName}*\n*System:* ${task.system}\n*Action:* ${task.action}\n*Reason:* ${
            task.reason ?? "n/a"
          }\n*Confidence:* ${task.confidence ?? "n/a"}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            style: "primary",
            text: { type: "plain_text", text: "Approve" },
            action_id: "approve_task",
            value: task.id,
          },
          {
            type: "button",
            style: "danger",
            text: { type: "plain_text", text: "Reject" },
            action_id: "reject_task",
            value: task.id,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Open in dashboard" },
            url: `${appUrl}/approvals`,
            action_id: "open_dashboard",
          },
        ],
      },
    ],
  });
}

export async function notifyFailure(task: TaskRow, hireName: string, owningTeam: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const channel = alertChannel();
  const detail = `Hire: ${hireName}${owningTeam ? ` (owner: ${owningTeam})` : ""}\nSystem: ${
    task.system
  }\nAction: ${task.action}\nRetries: ${task.retry_count}\nError: ${
    task.error_message ?? "not provided"
  }\nRaw response:\n${(task.raw_response ?? "not provided").slice(0, 2500)}`;

  let sendError: string | null = null;
  if (channel) {
    const res = await slackCall("chat.postMessage", {
      channel,
      text: `:rotating_light: Provisioning failed after ${task.retry_count} retries`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:rotating_light: *Provisioning failed* after ${task.retry_count} retries\n*${hireName}* · ${task.system} · ${task.action}`,
          },
        },
        { type: "section", text: { type: "mrkdwn", text: "```" + detail.slice(0, 2800) + "```" } },
      ],
    });
    if (!res.ok) sendError = `${res.error}: ${res.raw.slice(0, 500)}`;
  } else {
    sendError = "No Slack alert channel configured";
  }

  await supabaseAdmin.from("alert_log").insert({
    task_id: task.id,
    hire_id: task.hire_id,
    kind: "task_failed",
    channel: channel ? "slack" : "none",
    detail,
    send_error: sendError,
  });
}
