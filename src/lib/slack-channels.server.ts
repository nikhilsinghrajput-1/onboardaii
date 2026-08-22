import { loadOrgById, slackCallForOrg, type OrgRow } from "./org-ops.server";

const SYSTEM = "slack";
const ACTION = "create_onboarding_channel";

export type ChannelResult = {
  ok: boolean;
  channelId: string | null;
  channelName: string | null;
  error: string | null;
};

/** Slack channel names: lowercase, no spaces/punctuation, max 80 chars. */
export function channelNameForHire(fullName: string, externalId: string | null): string {
  const base = fullName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  const suffix = (externalId ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(-4);
  return `onboard-${base || "new-hire"}${suffix ? `-${suffix}` : ""}`.slice(0, 80);
}

async function recordTask(
  orgId: string,
  hireId: string,
  status: "completed" | "failed",
  detail: { reason: string; error?: string | null; raw?: string | null },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("onboarding_tasks")
    .select("id")
    .eq("org_id", orgId)
    .eq("hire_id", hireId)
    .eq("system", SYSTEM)
    .eq("action", ACTION)
    .maybeSingle();

  const row = {
    org_id: orgId,
    hire_id: hireId,
    system: SYSTEM,
    action: ACTION,
    reason: detail.reason,
    sensitive: false,
    status,
    error_message: detail.error ?? null,
    raw_response: detail.raw ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    await supabaseAdmin.from("onboarding_tasks").update(row).eq("id", existing.id);
  } else {
    await supabaseAdmin.from("onboarding_tasks").insert(row);
  }
}

type HireRow = {
  id: string;
  full_name: string;
  role: string;
  department: string;
  start_date: string | null;
  external_id: string | null;
  slack_channel_id: string | null;
  slack_channel_name: string | null;
};

/**
 * Creates (or re-uses) a dedicated Slack channel for one hire in the organization's
 * own connected Slack workspace, then posts the onboarding kickoff message.
 * Idempotent: an existing channel on the hire row is returned untouched.
 */
export async function ensureHireChannel(
  orgId: string,
  hireId: string,
): Promise<ChannelResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const org: OrgRow | null = await loadOrgById(orgId);
  if (!org) return { ok: false, channelId: null, channelName: null, error: "Organization not found" };

  const { data: hire, error: hireError } = await supabaseAdmin
    .from("hires")
    .select(
      "id, full_name, role, department, start_date, external_id, slack_channel_id, slack_channel_name",
    )
    .eq("org_id", orgId)
    .eq("id", hireId)
    .maybeSingle();
  if (hireError) throw hireError;
  if (!hire) return { ok: false, channelId: null, channelName: null, error: "Hire not found" };

  const row = hire as HireRow;
  if (row.slack_channel_id) {
    // Channel already exists — close the task so a re-run never leaves it "in progress".
    await recordTask(orgId, hireId, "completed", {
      reason: `Dedicated Slack channel #${row.slack_channel_name ?? "onboarding"} already exists`,
    });
    return {
      ok: true,
      channelId: row.slack_channel_id,
      channelName: row.slack_channel_name,
      error: null,
    };
  }


  const name = channelNameForHire(row.full_name, row.external_id);
  const created = await slackCallForOrg(orgId, "conversations.create", {
    name,
    is_private: false,
  });

  let channelId: string | null = null;
  let channelName = name;

  if (created.ok) {
    const parsed = JSON.parse(created.raw) as { channel?: { id?: string; name?: string } };
    channelId = parsed.channel?.id ?? null;
    channelName = parsed.channel?.name ?? name;
  } else if (created.error === "name_taken") {
    // Channel already exists in the workspace — adopt it instead of failing.
    const found = await slackCallForOrg(orgId, "conversations.list", {
      limit: 1000,
      types: "public_channel",
      exclude_archived: true,
    });
    if (found.ok) {
      const parsed = JSON.parse(found.raw) as { channels?: { id: string; name: string }[] };
      const match = parsed.channels?.find((c) => c.name === name);
      if (match) {
        channelId = match.id;
        channelName = match.name;
      }
    }
  }

  if (!channelId) {
    const message =
      created.error === "missing_scope"
        ? "Slack app is missing the channels:manage scope needed to create channels."
        : created.error === "slack_not_connected"
          ? "This organization has not connected a Slack workspace yet."
          : `Slack could not create the channel (${created.error ?? "unknown error"}).`;
    await supabaseAdmin
      .from("hires")
      .update({ slack_channel_error: message, updated_at: new Date().toISOString() })
      .eq("id", hireId);
    await recordTask(orgId, hireId, "failed", {
      reason: `Create dedicated Slack channel #${name}`,
      error: message,
      raw: created.raw.slice(0, 4000),
    });
    return { ok: false, channelId: null, channelName: name, error: message };
  }

  await slackCallForOrg(orgId, "conversations.setPurpose", {
    channel: channelId,
    purpose: `Onboarding coordination for ${row.full_name} (${row.role}, ${row.department}).`,
  });

  await slackCallForOrg(orgId, "chat.postMessage", {
    channel: channelId,
    text: `Onboarding started for ${row.full_name}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Onboarding started: ${row.full_name}*\n${row.role} · ${row.department}${
            row.start_date ? ` · starts ${row.start_date}` : ""
          }`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Provisioning updates and approval requests for this hire land here. Organization: ${org.name}`,
          },
        ],
      },
    ],
  });

  await supabaseAdmin
    .from("hires")
    .update({
      slack_channel_id: channelId,
      slack_channel_name: channelName,
      slack_channel_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", hireId);

  await recordTask(orgId, hireId, "completed", {
    reason: `Dedicated Slack channel #${channelName} created and kickoff message posted`,
    raw: created.raw.slice(0, 4000),
  });

  return { ok: true, channelId, channelName, error: null };
}
