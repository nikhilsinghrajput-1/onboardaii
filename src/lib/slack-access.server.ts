import { slackCallForOrg } from "./org-ops.server";

const SYSTEM = "slack";

export type AccessResult = {
  ok: boolean;
  channels: string[];
  error: string | null;
};

/** Channels every new hire gets access to. Kept small and explicit for now. */
export const DEFAULT_ACCESS_CHANNELS = ["general"];

async function recordTask(
  orgId: string,
  hireId: string,
  action: string,
  status: "completed" | "failed" | "needs_human",
  detail: { reason: string; error?: string | null; raw?: string | null },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("onboarding_tasks")
    .select("id")
    .eq("org_id", orgId)
    .eq("hire_id", hireId)
    .eq("system", SYSTEM)
    .eq("action", action)
    .maybeSingle();

  const row = {
    org_id: orgId,
    hire_id: hireId,
    system: SYSTEM,
    action,
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

async function findChannelIdByName(orgId: string, name: string): Promise<string | null> {
  let cursor = "";
  do {
    const page = await slackCallForOrg(orgId, "conversations.list", {
      limit: 200,
      types: "public_channel",
      exclude_archived: true,
      ...(cursor ? { cursor } : {}),
    });
    if (!page.ok) return null;
    const parsed = JSON.parse(page.raw) as {
      channels?: { id: string; name: string }[];
      response_metadata?: { next_cursor?: string };
    };
    const hit = parsed.channels?.find((c) => c.name === name.replace(/^#/, ""));
    if (hit) return hit.id;
    cursor = parsed.response_metadata?.next_cursor ?? "";
  } while (cursor);
  return null;
}

export type InviteResult = {
  ok: boolean;
  /** Slack user id once the person exists in the workspace. */
  slackUserId: string | null;
  /** True when a human still has to send the workspace invite by hand. */
  needsHuman: boolean;
  error: string | null;
};

async function lookupSlackUserId(orgId: string, email: string) {
  const lookup = await slackCallForOrg(orgId, "users.lookupByEmail", { email });
  if (!lookup.ok) return { id: null as string | null, error: lookup.error ?? "unknown", raw: lookup.raw };
  const id = (JSON.parse(lookup.raw) as { user?: { id?: string } }).user?.id ?? null;
  return { id, error: null as string | null, raw: lookup.raw };
}

async function teamId(orgId: string): Promise<string | null> {
  const res = await slackCallForOrg(orgId, "auth.test", {});
  if (!res.ok) return null;
  return (JSON.parse(res.raw) as { team_id?: string }).team_id ?? null;
}

/**
 * Step 1 of Slack onboarding: make sure the hire is a member of the workspace.
 * Tries the Slack admin invite API (Enterprise Grid / Business+ with
 * admin.users:write). When Slack does not allow programmatic invites, the step
 * is parked as `needs_human` so someone can send the invite from Slack —
 * channel access is only attempted once the person exists in the workspace.
 */
export async function inviteToWorkspace(orgId: string, hireId: string): Promise<InviteResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: hire, error } = await supabaseAdmin
    .from("hires")
    .select("id, full_name, email, slack_channel_id")
    .eq("org_id", orgId)
    .eq("id", hireId)
    .maybeSingle();
  if (error) throw error;
  if (!hire) return { ok: false, slackUserId: null, needsHuman: false, error: "Hire not found" };

  const row = hire as { full_name: string; email: string | null; slack_channel_id: string | null };
  const action = "invite_to_workspace";
  const reason = `Invite ${row.full_name} to the Acropolis Slack workspace`;

  if (!row.email) {
    const message = "This hire has no email address, so they cannot be invited to Slack.";
    await recordTask(orgId, hireId, action, "failed", { reason, error: message });
    return { ok: false, slackUserId: null, needsHuman: false, error: message };
  }

  // Already in the workspace? Nothing to do.
  const existing = await lookupSlackUserId(orgId, row.email);
  if (existing.id) {
    await recordTask(orgId, hireId, action, "completed", {
      reason: `${row.full_name} is a member of the Slack workspace`,
    });
    return { ok: true, slackUserId: existing.id, needsHuman: false, error: null };
  }
  if (existing.error === "slack_not_connected") {
    const message = "No Slack workspace is connected yet (Wiring → Slack).";
    await recordTask(orgId, hireId, action, "failed", { reason, error: message });
    return { ok: false, slackUserId: null, needsHuman: false, error: message };
  }

  const team = await teamId(orgId);
  const invite = await slackCallForOrg(orgId, "admin.users.invite", {
    email: row.email,
    real_name: row.full_name,
    resend: true,
    ...(team ? { team_id: team } : {}),
    ...(row.slack_channel_id ? { channel_ids: row.slack_channel_id } : {}),
  });

  if (invite.ok || invite.error === "already_in_team" || invite.error === "already_invited") {
    // The person may not have accepted yet, so a user id can still be missing.
    const after = await lookupSlackUserId(orgId, row.email);
    await recordTask(orgId, hireId, action, after.id ? "completed" : "needs_human", {
      reason: after.id
        ? `${row.full_name} is a member of the Slack workspace`
        : `${reason} — invitation sent, waiting for them to accept`,
      error: after.id ? null : "Slack invitation sent; access follows once they accept.",
      raw: invite.raw.slice(0, 4000),
    });
    return {
      ok: Boolean(after.id),
      slackUserId: after.id,
      needsHuman: !after.id,
      error: after.id ? null : "Slack invitation sent — waiting for the hire to accept.",
    };
  }

  const message =
    invite.error === "missing_scope" || invite.error === "not_allowed_token_type"
      ? `Slack does not allow this app to invite people automatically. Invite ${row.email} to the workspace from Slack, then re-run onboarding.`
      : invite.error === "feature_not_enabled" || invite.error === "not_an_enterprise"
        ? `Automatic workspace invites need a Slack plan that exposes admin invites. Invite ${row.email} manually, then re-run onboarding.`
        : `Slack could not invite ${row.email} (${invite.error ?? "unknown error"}). Invite them manually, then re-run onboarding.`;

  await recordTask(orgId, hireId, action, "needs_human", {
    reason,
    error: message,
    raw: invite.raw.slice(0, 4000),
  });
  return { ok: false, slackUserId: null, needsHuman: true, error: message };
}

/**
 * Gives one hire access to the organization's shared onboarding channels
 * (currently #general) plus their own onboarding channel, by looking the person
 * up in Slack by email and inviting them. Idempotent: an already-present member
 * is treated as success.
 */
export async function grantSlackAccess(orgId: string, hireId: string): Promise<AccessResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: hire, error } = await supabaseAdmin
    .from("hires")
    .select("id, full_name, email, slack_channel_id, slack_channel_name")
    .eq("org_id", orgId)
    .eq("id", hireId)
    .maybeSingle();
  if (error) throw error;
  if (!hire) return { ok: false, channels: [], error: "Hire not found" };

  const row = hire as {
    full_name: string;
    email: string | null;
    slack_channel_id: string | null;
    slack_channel_name: string | null;
  };

  const action = "grant_channel_access";
  const targets = [...DEFAULT_ACCESS_CHANNELS];

  if (!row.email) {
    const message = "This hire has no email address, so they cannot be found in Slack.";
    await recordTask(orgId, hireId, action, "failed", {
      reason: `Invite ${row.full_name} to #${targets.join(", #")}`,
      error: message,
    });
    return { ok: false, channels: [], error: message };
  }

  const lookup = await slackCallForOrg(orgId, "users.lookupByEmail", { email: row.email });
  if (!lookup.ok) {
    const message =
      lookup.error === "users_not_found"
        ? `No Slack account found for ${row.email}. Invite them to the workspace first.`
        : lookup.error === "missing_scope"
          ? "Slack app is missing the users:read.email scope needed to find people by email."
          : lookup.error === "slack_not_connected"
            ? "This organization has not connected a Slack workspace yet."
            : `Slack lookup failed (${lookup.error ?? "unknown error"}).`;
    await recordTask(orgId, hireId, action, "failed", {
      reason: `Invite ${row.full_name} to #${targets.join(", #")}`,
      error: message,
      raw: lookup.raw.slice(0, 4000),
    });
    return { ok: false, channels: [], error: message };
  }

  const slackUserId = (JSON.parse(lookup.raw) as { user?: { id?: string } }).user?.id;
  if (!slackUserId) {
    const message = "Slack returned no user for that email address.";
    await recordTask(orgId, hireId, action, "failed", {
      reason: `Invite ${row.full_name} to #${targets.join(", #")}`,
      error: message,
    });
    return { ok: false, channels: [], error: message };
  }

  const joined: string[] = [];
  const failures: string[] = [];

  const invites: { label: string; channelId: string | null }[] = [];
  for (const name of targets) {
    invites.push({ label: name, channelId: await findChannelIdByName(orgId, name) });
  }
  if (row.slack_channel_id) {
    invites.push({
      label: row.slack_channel_name ?? "onboarding channel",
      channelId: row.slack_channel_id,
    });
  }

  for (const invite of invites) {
    if (!invite.channelId) {
      failures.push(`#${invite.label}: channel not found in this workspace`);
      continue;
    }
    const res = await slackCallForOrg(orgId, "conversations.invite", {
      channel: invite.channelId,
      users: slackUserId,
    });
    if (res.ok || res.error === "already_in_channel") {
      joined.push(invite.label);
    } else if (res.error === "missing_scope") {
      failures.push(`#${invite.label}: Slack app is missing the channels:manage scope`);
    } else {
      failures.push(`#${invite.label}: ${res.error ?? "unknown error"}`);
    }
  }

  const ok = joined.length > 0 && failures.length === 0;
  await recordTask(orgId, hireId, action, ok ? "completed" : "failed", {
    reason: joined.length
      ? `${row.full_name} added to #${joined.join(", #")}`
      : `Invite ${row.full_name} to #${targets.join(", #")}`,
    error: failures.length ? failures.join("; ") : null,
  });

  return { ok, channels: joined, error: failures.length ? failures.join("; ") : null };
}
