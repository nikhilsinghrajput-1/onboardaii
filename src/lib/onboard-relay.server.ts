import { createHmac, timingSafeEqual } from "node:crypto";

import { getSingleOrg } from "./org-ops.server";

export type RelayVerifyResult = {
  signature_verified: boolean;
  forwarded: boolean;
  upstream_status: number | null;
  upstream_body?: string;
  forwarded_to?: string;
  error?: string;
};

/** Shared secret used to verify `x-onboard-signature`. Read at request time only. */
function resolveSecret(orgSecret?: string | null): string | null {
  return (
    process.env["ONBOARD_WEBHOOK_SECRET"] ||
    process.env["ONBOARDING_WEBHOOK_SECRET"] ||
    orgSecret ||
    null
  );
}

/** Destination viaSocket catch-hook URL. */
function resolveTarget(orgFlowUrl?: string | null): string | null {
  return process.env["VIASOCKET_WEBHOOK_URL"] || orgFlowUrl || null;
}

/** Timing-safe HMAC-SHA256 check over the RAW body. Accepts `sha256=<hex>` or bare hex. */
export function verifyOnboardSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): boolean {
  if (!header) return false;
  const given = header.trim().replace(/^sha256=/i, "");
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(given.toLowerCase(), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function log(level: "info" | "error", stage: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({ scope: "onboard-relay", stage, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

/** Verifies the inbound onboarding webhook and forwards it to viaSocket when valid. */
export async function handleOnboardRelay(request: Request): Promise<Response> {
  // 1. Raw body exactly as received — never re-stringified JSON.
  const raw = await request.text();
  const signatureHeader = request.headers.get("x-onboard-signature");

  const org = await getSingleOrg().catch(() => null);
  const secret = resolveSecret(org?.webhook_secret);
  const target = resolveTarget(org?.flow_trigger_url);

  if (!secret) {
    log("error", "config", { reason: "missing_secret" });
    return Response.json(
      { signature_verified: false, forwarded: false, error: "ONBOARD_WEBHOOK_SECRET is not set" },
      { status: 503 },
    );
  }

  const verified = verifyOnboardSignature(raw, signatureHeader, secret);
  log(verified ? "info" : "error", "verify", {
    verified,
    has_signature: Boolean(signatureHeader),
    body_bytes: raw.length,
  });

  if (!verified) {
    return Response.json(
      { signature_verified: false, forwarded: false, error: "invalid signature" },
      { status: 401 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("body must be a JSON object");
    }
    payload = parsed as Record<string, unknown>;
  } catch (error) {
    return Response.json(
      {
        signature_verified: true,
        forwarded: false,
        error: error instanceof Error ? error.message : "invalid JSON",
      },
      { status: 400 },
    );
  }

  if (!target) {
    log("error", "config", { reason: "missing_target" });
    return Response.json(
      {
        signature_verified: true,
        forwarded: false,
        error: "VIASOCKET_WEBHOOK_URL is not set (or Wiring → Flow trigger URL is empty)",
      },
      { status: 503 },
    );
  }

  // 2. Preserve all original fields, add the verification marker.
  const forwardBody = JSON.stringify({ signature_verified: true, ...payload });

  try {
    const res = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Original signature forwarded for downstream audit only.
        ...(signatureHeader ? { "x-onboard-signature": signatureHeader } : {}),
        "x-onboard-verified": "true",
      },
      body: forwardBody,
    });
    const text = await res.text();
    log(res.ok ? "info" : "error", "forward", {
      host: new URL(target).host,
      status: res.status,
      response_preview: text.slice(0, 300),
    });
    return Response.json({
      signature_verified: true,
      forwarded: res.ok,
      upstream_status: res.status,
      upstream_body: text.slice(0, 1000),
      forwarded_to: target,
      ...(res.ok ? {} : { error: `upstream returned ${res.status}` }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    log("error", "forward", { error: detail });
    return Response.json({
      signature_verified: true,
      forwarded: false,
      upstream_status: null,
      forwarded_to: target,
      error: detail,
    });
  }
}

/** Redacted diagnostics: shows what the relay would use, never the secret itself. */
export async function onboardRelayDiagnostics(): Promise<Response> {
  const org = await getSingleOrg().catch(() => null);
  const secret = resolveSecret(org?.webhook_secret);
  const target = resolveTarget(org?.flow_trigger_url);
  return Response.json({
    ok: Boolean(secret && target),
    secret_configured: Boolean(secret),
    secret_source: process.env["ONBOARD_WEBHOOK_SECRET"]
      ? "ONBOARD_WEBHOOK_SECRET"
      : process.env["ONBOARDING_WEBHOOK_SECRET"]
        ? "ONBOARDING_WEBHOOK_SECRET"
        : org?.webhook_secret
          ? "organization.webhook_secret"
          : null,
    secret_preview: secret ? "***" : null,
    target_url: target,
    target_source: process.env["VIASOCKET_WEBHOOK_URL"]
      ? "VIASOCKET_WEBHOOK_URL"
      : org?.flow_trigger_url
        ? "organization.flow_trigger_url"
        : null,
    expected_headers: {
      "content-type": "application/json",
      "x-onboard-signature": "sha256=<hex hmac-sha256 of raw body>",
    },
    forwarded_headers: {
      "content-type": "application/json",
      "x-onboard-signature": "<original header, forwarded for audit>",
      "x-onboard-verified": "true",
    },
    added_body_fields: { signature_verified: true },
    time: new Date().toISOString(),
  });
}
