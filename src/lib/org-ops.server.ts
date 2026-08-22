import { createHmac, timingSafeEqual } from "node:crypto";

import { GATEWAY_BASE_URL, getOrgConnectionKey } from "./connections.server";

export type OrgRow = {
  id: string;
  name: string;
  slug: string;
  webhook_secret: string;
  slack_approval_channel: string | null;
  slack_alert_channel: string | null;
  resume_url: string | null;
};

const ORG_COLUMNS =
  "id, name, slug, webhook_secret, slack_approval_channel, slack_alert_channel, resume_url";

export async function loadOrgBySlug(slug: string): Promise<OrgRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select(ORG_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as OrgRow | null) ?? null;
}

export async function loadOrgById(id: string): Promise<OrgRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select(ORG_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as OrgRow | null) ?? null;
}

/** Timing-safe HMAC-SHA256 check of a raw body against one organization's own secret. */
export function verifyOrgSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = signature.trim().replace(/^sha256=/, "");
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type SlackResult = { ok: boolean; error?: string; raw: string };

/**
 * Calls the Slack Web API with the organization's own connected Slack workspace.
 * Falls back to the app-level Slack connection when the org has not connected one.
 */
export async function slackCallForOrg(
  orgId: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<SlackResult> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) {
    return { ok: false, error: "gateway_key_missing", raw: "LOVABLE_API_KEY is not set" };
  }

  let connectionKey: string | null = null;
  try {
    connectionKey = await getOrgConnectionKey(orgId, "slack");
  } catch (error) {
    console.error("org slack key lookup failed", error);
  }
  if (!connectionKey) {
    const fallback = ["SLACK_API_KEY_1", "SLACK_API_KEY"].find((name) => process.env[name]);
    connectionKey = fallback ? process.env[fallback]! : null;
  }
  if (!connectionKey) {
    return { ok: false, error: "slack_not_connected", raw: "No Slack connection for this org" };
  }

  // Slack's Web API only accepts JSON bodies for methods with complex payloads
  // (blocks, attachments). Simple string/number args (users.lookupByEmail,
  // conversations.list/invite) must be form-encoded, otherwise Slack answers
  // with invalid_arguments.
  const isComplex = Object.values(payload).some(
    (value) => value !== null && typeof value === "object",
  );
  let body: string;
  let contentType: string;
  if (isComplex) {
    body = JSON.stringify(payload);
    contentType = "application/json; charset=utf-8";
  } else {
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null) continue;
      form.set(key, String(value));
    }
    body = form.toString();
    contentType = "application/x-www-form-urlencoded; charset=utf-8";
  }

  try {
    const res = await fetch(`${GATEWAY_BASE_URL}/slack/api/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
      },
      body,
    });

    const raw = await res.text();
    if (!res.ok) {
      console.error(`Slack gateway ${method} failed [${res.status}]: ${raw}`);
      return { ok: false, error: `http_${res.status}`, raw };
    }
    const parsed = JSON.parse(raw) as { ok?: boolean; error?: string };
    if (!parsed.ok) {
      console.error(`Slack ${method} returned not-ok: ${raw}`);
      return { ok: false, error: parsed.error ?? "slack_error", raw };
    }
    return { ok: true, raw };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(`Slack ${method} threw: ${raw}`);
    return { ok: false, error: "request_failed", raw };
  }
}

/** Posts a human decision back to the organization's own flow resume URL. */
export async function resumeForOrg(
  org: OrgRow,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; detail: string }> {
  const url = org.resume_url ?? process.env["VIASOCKET_RESUME_URL"];
  if (!url) return { ok: false, detail: "No flow resume URL configured for this organization" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`flow resume failed [${res.status}]: ${text}`);
      return { ok: false, detail: `[${res.status}] ${text}` };
    }
    return { ok: true, detail: text.slice(0, 500) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`flow resume threw: ${detail}`);
    return { ok: false, detail };
  }
}
