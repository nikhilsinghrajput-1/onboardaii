import { createHmac, timingSafeEqual } from "node:crypto";

/** True when the app-level Slack connection (used as a fallback) is available. */
export function slackConfigured(): boolean {
  const key = ["SLACK_API_KEY_1", "SLACK_API_KEY"].some((name) => process.env[name]);
  return Boolean(key && process.env["LOVABLE_API_KEY"]);
}

/** Verifies Slack interactivity payloads with the Slack signing secret. */
export function verifySlackSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
) {
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
