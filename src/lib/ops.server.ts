import { createHmac, timingSafeEqual } from "node:crypto";

const GATEWAY_BASE =
  process.env["CONNECTOR_GATEWAY_BASE_URL"] ?? "https://connector-gateway.lovable.dev";

/** Timing-safe HMAC-SHA256 check of a raw request body against the shared viaSocket secret. */
export function verifyViaSocketSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env["VIASOCKET_WEBHOOK_SECRET"];
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = signature.trim().replace(/^sha256=/, "");
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function viaSocketSecretConfigured(): boolean {
  return Boolean(process.env["VIASOCKET_WEBHOOK_SECRET"]);
}

function slackKeyName(): string | null {
  for (const name of ["SLACK_API_KEY_1", "SLACK_API_KEY"]) {
    if (process.env[name]) return name;
  }
  return null;
}

export function slackConfigured(): boolean {
  return Boolean(slackKeyName() && process.env["LOVABLE_API_KEY"]);
}

/** Calls the Slack Web API through the Lovable connector gateway. */
export async function slackCall(
  method: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; raw: string }> {
  const keyName = slackKeyName();
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!keyName || !lovableKey) {
    return { ok: false, error: "slack_not_connected", raw: "Slack connection is not configured" };
  }
  try {
    const res = await fetch(`${GATEWAY_BASE}/slack/api/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": process.env[keyName]!,
      },
      body: JSON.stringify(payload),
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

export function approvalChannel(): string | undefined {
  return process.env["SLACK_APPROVAL_CHANNEL"];
}

export function alertChannel(): string | undefined {
  return process.env["SLACK_ALERT_CHANNEL"] ?? process.env["SLACK_APPROVAL_CHANNEL"];
}

/** Tells the viaSocket flow the outcome of a human decision so it can resume or halt. */
export async function resumeViaSocket(body: Record<string, unknown>): Promise<{
  ok: boolean;
  detail: string;
}> {
  const url = process.env["VIASOCKET_RESUME_URL"];
  if (!url) return { ok: false, detail: "VIASOCKET_RESUME_URL is not configured" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`viaSocket resume failed [${res.status}]: ${text}`);
      return { ok: false, detail: `[${res.status}] ${text}` };
    }
    return { ok: true, detail: text.slice(0, 500) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`viaSocket resume threw: ${detail}`);
    return { ok: false, detail };
  }
}

export function verifySlackSignature(rawBody: string, timestamp: string | null, signature: string | null) {
  const secretName = process.env["SLACK_SIGNING_SECRET"]
    ? "SLACK_SIGNING_SECRET"
    : Object.keys(process.env).find((k) => k.startsWith("SLACK_SIGNING_SECRET"));
  const secret = secretName ? process.env[secretName] : undefined;
  if (!secret) return "no_secret" as const;
  if (!timestamp || !signature) return "invalid" as const;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 * 5) return "invalid" as const;
  const expected =
    "v0=" + createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return "invalid" as const;
  return timingSafeEqual(a, b) ? ("valid" as const) : ("invalid" as const);
}
