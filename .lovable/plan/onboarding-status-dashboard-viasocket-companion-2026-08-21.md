# Onboarding Status Dashboard (viaSocket companion)

viaSocket keeps running the flow (trigger, AI reasoning, dispatch, retries). This app is the real-time
view and the human-approval surface: viaSocket pushes hire and task state here, and this app pushes
approval decisions back.

## What gets built

**1. Hire intake webhook**
A public endpoint viaSocket calls when a new hire record is created. Captures role, department,
seniority, employment type, location, and the flags (PII access, on-call, direct reports). Requests are
signature-verified with a shared secret; unsigned or wrong-signature calls are rejected.

**2. Task state ingestion**
A second public endpoint viaSocket calls after every action step. Upserts one row per (hire, task) with
status (`not_started`, `in_progress`, `completed`, `failed`, `needs_human`), system, action, reason,
confidence, retry count, timestamp, and the raw API response text on failure — so a human debugging a
viaSocket failure sees the provider's actual error, not a vague step message.

**3. Dashboard**
- Overview: all hires with progress ring, counts by status, blocked/needs-approval badges, live updates.
- Hire detail: full task list grouped by system, status timeline, retry counts, expandable raw error
  payload, filter by status/system.
- Realtime subscription so state changes appear without refresh.

**4. Approval queue (in-app + Slack)**
Tasks arriving as `needs_human` (sensitive system or low confidence) land in an approval queue.
- In-app: Approve / Reject with a required note, decided-by and decided-at recorded as an audit trail.
- Slack: a message is posted to a configured channel with hire, system, action, reason, confidence, and
  a link back to the in-app approval. Approve/Reject buttons in Slack write the same decision.
- On decision, the app calls back to a viaSocket resume webhook so the flow continues or halts.

**5. Alerts**
When a task reaches `failed` after max retries, the app posts a Slack alert to the owning team's channel
with hire name, system, error detail, and the raw response attached.

**6. Access**
Dashboard and approvals are behind sign-in (email/password). Only signed-in users see hire data;
webhooks authenticate by signature, not by session.

## Technical notes

- Lovable Cloud provides the database, auth, and realtime. Tables: `hires`, `onboarding_tasks`,
  `approvals`, `alert_log`. RLS on all of them; webhook writes go through server-side privileged code.
- Public endpoints: `/api/public/viasocket/hire`, `/api/public/viasocket/task`,
  `/api/public/slack/events` (Slack interactivity). HMAC verification on the viaSocket routes with a
  `VIASOCKET_WEBHOOK_SECRET`; Slack signature verification on the Slack route.
- Slack is a real integration via the Slack connector (`chat:write`) plus a provisioned Slack app for
  interactive buttons. This needs a Slack connection approved in-chat and a publish before Slack can
  reach the endpoint.
- Outbound resume call to viaSocket uses a `VIASOCKET_RESUME_URL` secret.
- Secrets to collect: `VIASOCKET_WEBHOOK_SECRET`, `VIASOCKET_RESUME_URL`, plus the Slack channel ID for
  approvals and the alerts channel.

## Build order

1. Enable Lovable Cloud, create tables + RLS, sign-in page and protected layout.
2. Webhook endpoints with signature verification; seed demo hires/tasks so the dashboard is viewable
   before viaSocket is wired.
3. Dashboard overview + hire detail with realtime.
4. In-app approval queue with audit trail and viaSocket resume callback.
5. Slack connector: approval messages and failure alerts; then provision the Slack app and publish for
   interactive buttons.
