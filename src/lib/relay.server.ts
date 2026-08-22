import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

export type EndpointType = "task-update" | "hire-update";

export type RelayResult = {
  ok: boolean;
  forwarded_to: string;
  status_code: number | null;
  attempts: number;
  endpoint_type: EndpointType;
  error?: string;
  duration_ms?: number;
};

export const relayBodySchema = z.object({
  callback_url: z.string().min(1, "callback_url is required").max(2000),
  payload: z.record(z.string(), z.unknown()),
  headers: z.record(z.string(), z.string().max(4000)).optional(),
});

export type RelayBody = z.infer<typeof relayBodySchema>;

const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 15_000;
const BACKOFF_MS = [500, 1000, 2000];

/** Headers we never forward: hop-by-hop, or ones fetch must own. */
const BLOCKED_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-authorization",
  "proxy-authenticate",
  "te",
  "trailer",
  "x-relay-secret",
]);

const SENSITIVE_HEADERS = new Set(["authorization", "x-relay-secret", "cookie", "x-api-key"]);

/* ------------------------------------------------------------------ logging */

type LogFields = Record<string, string | number | boolean | null | undefined>;

function log(level: "info" | "error", stage: string, fields: LogFields) {
  const line = JSON.stringify({ scope: "relay", stage, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

/** Masks secret-bearing header values so logs never contain credentials. */
export function redactHeaders(headers: Record<string, string> | undefined) {
  if (!headers) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? "***" : value;
  }
  return out;
}

/* ---------------------------------------------------------------- auth/limit */

export function relaySecretConfigured(): boolean {
  return Boolean(process.env["RELAY_SHARED_SECRET"]);
}

/** Timing-safe comparison of the caller's x-relay-secret header. */
export function verifyRelaySecret(provided: string | null): "valid" | "invalid" | "no_secret" {
  const expected = process.env["RELAY_SHARED_SECRET"];
  if (!expected) return "no_secret";
  if (!provided) return "invalid";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return "invalid";
  return timingSafeEqual(a, b) ? "valid" : "invalid";
}

// Best-effort in-memory limiter: 60 requests / minute per caller key, scoped to
// this worker instance.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const buckets = new Map<string, number[]>();

export function checkRateLimit(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    const oldest = hits[0] ?? now;
    return { allowed: false, retryAfter: Math.ceil((WINDOW_MS - (now - oldest)) / 1000) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return { allowed: true, retryAfter: 0 };
}

export function callerKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip") || "unknown";
  return `${ip}`;
}

/* ------------------------------------------------------------ url validation */

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
  /\.local$/i,
  /\.internal$/i,
];

export type UrlCheck =
  | { ok: true; url: URL }
  | { ok: false; status: number; error: string };

/** Validates protocol, blocks private/loopback targets, applies the allowlist. */
export function validateCallbackUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, status: 400, error: "callback_url is not a valid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, status: 400, error: "callback_url must use http or https" };
  }
  const host = url.hostname;
  if (PRIVATE_HOST_PATTERNS.some((re) => re.test(host))) {
    return { ok: false, status: 400, error: "callback_url host is not routable" };
  }
  const allowlist = (process.env["RELAY_ALLOWED_HOSTS"] ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length > 0 && !allowlist.some((pattern) => hostMatches(host.toLowerCase(), pattern))) {
    return { ok: false, status: 403, error: `callback_url host ${host} is not allowlisted` };
  }
  return { ok: true, url };
}

function hostMatches(host: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1); // ".example.com"
    return host.endsWith(suffix) && host.length > suffix.length;
  }
  return host === pattern;
}

/* -------------------------------------------------------------- forwarding */

function outboundHeaders(supplied: Record<string, string> | undefined) {
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const [key, value] of Object.entries(supplied ?? {})) {
    if (BLOCKED_HEADERS.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }
  headers.set("Content-Type", "application/json");
  return headers;
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}…[truncated]` : value;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type DeliverOptions = {
  endpointType: EndpointType;
  body: RelayBody;
  source?: "api" | "ui";
};

/**
 * Forwards `payload` to `callback_url` with up to 3 attempts (exponential
 * backoff on network errors, timeouts, 429 and 5xx), records the delivery, and
 * returns the relay result. The caller has already been authenticated.
 */
export async function deliverCallback({
  endpointType,
  body,
  source = "api",
}: DeliverOptions): Promise<RelayResult> {
  const check = validateCallbackUrl(body.callback_url);
  if (!check.ok) {
    return {
      ok: false,
      forwarded_to: body.callback_url,
      status_code: null,
      attempts: 0,
      endpoint_type: endpointType,
      error: check.error,
    };
  }

  const target = check.url;
  const host = target.hostname;
  const outBody = JSON.stringify(body.payload);
  const headers = outboundHeaders(body.headers);
  const startedAt = Date.now();

  log("info", "inbound", {
    endpoint_type: endpointType,
    callback_host: host,
    source,
    body_bytes: outBody.length,
    forwarded_headers: Object.keys(redactHeaders(body.headers) ?? {}).join(",") || null,
  });

  let attempts = 0;
  let statusCode: number | null = null;
  let responsePreview: string | null = null;
  let error: string | null = null;
  let ok = false;

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    const attemptStart = Date.now();
    try {
      const response = await fetch(target.toString(), {
        method: "POST",
        headers,
        body: outBody,
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
      statusCode = response.status;
      responsePreview = truncate(await response.text().catch(() => ""), 2000);
      const retryable = response.status >= 500 || response.status === 429;
      ok = response.ok;
      error = ok ? null : `Callback responded ${response.status}`;
      log(ok ? "info" : "error", "attempt", {
        endpoint_type: endpointType,
        callback_host: host,
        attempt: attempts,
        status: response.status,
        duration_ms: Date.now() - attemptStart,
      });
      if (ok || !retryable) break;
    } catch (thrown) {
      statusCode = null;
      error = thrown instanceof Error ? thrown.message : String(thrown);
      log("error", "attempt", {
        endpoint_type: endpointType,
        callback_host: host,
        attempt: attempts,
        status: null,
        error,
        duration_ms: Date.now() - attemptStart,
      });
    }
    if (attempts < MAX_ATTEMPTS) await sleep(BACKOFF_MS[attempts - 1] ?? 2000);
  }

  const durationMs = Date.now() - startedAt;
  log(ok ? "info" : "error", "result", {
    endpoint_type: endpointType,
    callback_host: host,
    attempts,
    status: statusCode,
    ok,
    duration_ms: durationMs,
  });

  const payload = body.payload as Record<string, unknown>;
  const pick = (key: string) => (typeof payload[key] === "string" ? (payload[key] as string) : null);

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("relay_deliveries").insert({
      endpoint_type: endpointType,
      callback_url: body.callback_url,
      callback_host: host,
      ok,
      status_code: statusCode,
      attempts,
      error: ok ? null : (error ?? "Callback delivery failed"),
      event: pick("event"),
      hire_ref: pick("hire_id") ?? pick("hire_external_id") ?? pick("external_id"),
      employee_email: pick("employee_email") ?? pick("email"),
      payload_preview: truncate(outBody, 4000),
      response_preview: responsePreview,
      duration_ms: durationMs,
      source,
    });
  } catch (thrown) {
    log("error", "log_write_failed", {
      endpoint_type: endpointType,
      error: thrown instanceof Error ? thrown.message : String(thrown),
    });
  }

  return {
    ok,
    forwarded_to: body.callback_url,
    status_code: statusCode,
    attempts,
    endpoint_type: endpointType,
    duration_ms: durationMs,
    ...(ok ? {} : { error: error ?? "Callback delivery failed" }),
  };
}

/**
 * Full inbound handling for a relay endpoint: secret check, rate limit,
 * validation, forwarding. Returns the HTTP response to send back.
 */
export async function handleRelayRequest(
  request: Request,
  endpointType: EndpointType,
): Promise<Response> {
  const auth = verifyRelaySecret(request.headers.get("x-relay-secret"));
  if (auth !== "valid") {
    log("error", "unauthorized", { endpoint_type: endpointType, reason: auth });
    return Response.json(
      {
        ok: false,
        endpoint_type: endpointType,
        error:
          auth === "no_secret"
            ? "Relay is not configured (RELAY_SHARED_SECRET missing)"
            : "Unauthorized",
      },
      { status: auth === "no_secret" ? 503 : 401 },
    );
  }

  const limit = checkRateLimit(callerKey(request));
  if (!limit.allowed) {
    log("error", "rate_limited", { endpoint_type: endpointType });
    return Response.json(
      { ok: false, endpoint_type: endpointType, error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json(
      { ok: false, endpoint_type: endpointType, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = relayBodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        endpoint_type: endpointType,
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 },
    );
  }

  const result = await deliverCallback({ endpointType, body: parsed.data, source: "api" });
  const status = result.ok ? 200 : result.attempts === 0 ? 400 : 502;
  const { duration_ms: _duration, ...payload } = result;
  return Response.json(payload, { status });
}
