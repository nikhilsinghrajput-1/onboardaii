import { createHmac, timingSafeEqual } from "node:crypto";

import { GATEWAY_BASE_URL, appConnectionKey } from "./connections.server";

export type OrgRow = {
  id: string;
  name: string;
  slug: string;
  webhook_secret: string;
  slack_approval_channel: string | null;
  slack_alert_channel: string | null;
};

const ORG_COLUMNS =
  "id, name, slug, webhook_secret, slack_approval_channel, slack_alert_channel";

/** Single-tenant: there is exactly one organization row (Acropolis). */
export async function getSingleOrg(): Promise<OrgRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select(ORG_COLUMNS)
    .limit(1)
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

  // Prefer the workspace an admin connected through Slack OAuth on the wiring
  // page; fall back to the app-level Slack connection when none exists.
  const { getOrgConnectionKey } = await import("./connections.server");
  let connectionKey: string | undefined;
  try {
    connectionKey = (await getOrgConnectionKey(orgId, "slack")) ?? undefined;
  } catch (error) {
    console.error("org slack connection lookup failed", error);
  }
  connectionKey ??= appConnectionKey("slack");
  if (!connectionKey) {
    return { ok: false, error: "slack_not_connected", raw: "No Slack connection for this app" };
  }

  // Slack's Web API accepts JSON bodies only for methods with complex payloads
  // (blocks, attachments). Simple string/number args (users.lookupByEmail,
  // conversations.list/invite) go through as query params — the gateway does not
  // forward form-encoded bodies, which Slack then reports as invalid_arguments.
  const isComplex = Object.values(payload).some(
    (value) => value !== null && typeof value === "object",
  );

  let url = `${GATEWAY_BASE_URL}/slack/api/${method}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
  };
  let body: string | null = null;

  if (isComplex) {
    headers["Content-Type"] = "application/json; charset=utf-8";
    body = JSON.stringify(payload);
  } else {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null) continue;
      params.set(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  try {
    const res = await fetch(url, { method: "POST", headers, body });


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
