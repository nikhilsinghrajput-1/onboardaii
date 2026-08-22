import { GATEWAY_BASE_URL, getOrgConnectionKey } from "./connections.server";

export type MailResult = { ok: boolean; error: string | null; raw: string };

function base64Url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Minimal RFC 5322 message. Subject is encoded so non-ASCII survives. */
function buildRawMessage(to: string, subject: string, html: string): string {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
  const lines = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ];
  return base64Url(lines.join("\r\n"));
}

/**
 * Sends one email from the organization's own connected Gmail mailbox through the
 * Lovable connector gateway. Never throws — callers record the failure as a task.
 */
export async function sendMailForOrg(
  orgId: string,
  to: string,
  subject: string,
  html: string,
): Promise<MailResult> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) {
    return { ok: false, error: "gateway_key_missing", raw: "LOVABLE_API_KEY is not set" };
  }

  let connectionKey: string | null = null;
  try {
    connectionKey = await getOrgConnectionKey(orgId, "google_mail");
  } catch (error) {
    console.error("gmail key lookup failed", error);
  }
  if (!connectionKey) {
    return {
      ok: false,
      error: "gmail_not_connected",
      raw: "Gmail is not connected yet — connect it on the Wiring page.",
    };
  }

  try {
    const res = await fetch(`${GATEWAY_BASE_URL}/google_mail/gmail/v1/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: buildRawMessage(to, subject, html) }),
    });
    const raw = await res.text();
    if (!res.ok) {
      console.error(`Gmail send failed [${res.status}]: ${raw}`);
      return { ok: false, error: `http_${res.status}`, raw };
    }
    return { ok: true, error: null, raw };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(`Gmail send threw: ${raw}`);
    return { ok: false, error: "request_failed", raw };
  }
}

export function welcomeEmail(input: {
  fullName: string;
  role: string;
  department: string;
  startDate: string | null;
  orgName: string;
  slackChannel: string | null;
}) {
  const first = input.fullName.split(" ")[0] ?? input.fullName;
  const subject = `Welcome to ${input.orgName}, ${first}!`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111">
    <p>Hi ${first},</p>
    <p>Welcome to <strong>${input.orgName}</strong>. We're glad you're joining us as
    <strong>${input.role}</strong> in ${input.department}${
      input.startDate ? `, starting <strong>${input.startDate}</strong>` : ""
    }.</p>
    <p>Your onboarding is already in motion:</p>
    <ul>
      <li>Accounts and tool access are being provisioned for you.</li>
      ${
        input.slackChannel
          ? `<li>Your onboarding Slack channel <strong>#${input.slackChannel}</strong> is ready — that's where your buddy and IT will coordinate with you.</li>`
          : ""
      }
      <li>Anything that needs a human sign-off is queued with your onboarding team.</li>
    </ul>
    <p>If anything looks off, just reply to this email.</p>
    <p>— The ${input.orgName} onboarding team</p>
  </div>`;
  return { subject, html };
}
