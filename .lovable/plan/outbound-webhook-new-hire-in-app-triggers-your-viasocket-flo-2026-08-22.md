# Outbound webhook: new hire in app → triggers your viaSocket flow

Today the app only *receives* from viaSocket (`/hire`, `/task`). This adds the reverse direction: when
someone adds a hire in the dashboard, the app immediately POSTs that hire to your viaSocket flow's
trigger URL, so the flow (AI reasoning → dispatch → task updates back here) runs by itself.

## What gets built

**1. Per-organization "Flow trigger URL" setting**
The Wiring page gets a new field next to the existing Resume URL: the viaSocket webhook trigger URL for
that org. Each org points at its own flow. Stored on the organization record.

**2. Outbound call on hire creation**
`createHire` (used by the Add-new-hire dialog) fires the webhook after the hire row is saved, and also
after the Slack channel/access step so the payload carries the channel name. Payload:

```text
{
  event: "hire.created",
  org: { id, slug, name },
  hire: { id, external_id, full_name, email, role, department, start_date },
  slack: { channel_name },
  callbacks: {
    task_url: "https://<app>/api/public/viasocket/<org-slug>/task",
    hire_url: "https://<app>/api/public/viasocket/<org-slug>/hire"
  }
}
```

Signed with the org's existing `webhook_secret` as `x-onboard-signature: sha256=<hmac>` so the flow can
verify it came from this app. Includes the callback URLs so the flow knows where to report back without
hardcoding.

**3. Delivery visibility + retry**
The dispatch result (HTTP status and response body) is recorded, shown on the hire detail page as
"Flow triggered / Flow trigger failed", with a **Re-trigger flow** button. Hire creation never fails
because of a webhook error — the hire is still created and the error is surfaced.

## Technical notes

- Migration: add `flow_trigger_url text` to `public.organizations` (nullable). No new table.
- New `src/lib/flow-trigger.server.ts` with `triggerHireFlow(orgId, hireId)`; called from
  `createHire` in `src/lib/hires.functions.ts` and from a new `retriggerHireFlow` server fn.
- Reuse `verifyOrgSignature`'s HMAC scheme for the outbound signature.
- Wiring form (`approvals.functions.ts` org-settings update + `integrations.tsx`) gains the new field.
- Delivery status stored on the hire row (`flow_triggered_at`, `flow_trigger_error`) so the dashboard
  can show it without a new table.

## Step-by-step: connecting this app to your viaSocket flow

1. In viaSocket, open your flow and set its trigger to **Webhook** (a "Catch hook" / incoming webhook
   trigger). Copy the generated webhook URL.
2. In this app: **Wiring** → your organization → paste that URL into **Flow trigger URL** → Save.
3. Copy the org's **Webhook secret** from the same page. In viaSocket, if you want verification, add a
   first step that recomputes HMAC-SHA256 of the raw body with that secret and compares it to the
   `x-onboard-signature` header; otherwise skip verification.
4. In the app, add a test hire (Dashboard → **Add new hire**). viaSocket should show a run with the
   payload above; use that run's sample to map fields inside the flow.
5. In the flow's action steps, report progress back to this app: POST to
   `callbacks.task_url` with `hire_external_id`, `system`, `action`, `status`, plus optional `reason`,
   `confidence`, `sensitive`, `retry_count`, `error_message`, `raw_response`. Sign the body with the
   same org webhook secret and send it as `x-viasocket-signature: sha256=<hmac>`.
6. For human approval: send the task with `status: "needs_human"`, then add a **Wait for webhook**
   step. Put that wait step's resume URL into this app's **Resume URL** field on the Wiring page — the
   app calls it when someone approves or rejects.
7. Publish/enable the flow. From then on every hire added in the app starts a real run.

## Prompt to paste into viaSocket's AI flow builder

```text
Build an employee onboarding automation.

Trigger: an incoming webhook. The payload is:
{ event, org: {id, slug, name}, hire: {id, external_id, full_name, email, role, department, start_date},
  slack: {channel_name}, callbacks: {task_url, hire_url} }

Steps:
1. Verify the request: HMAC-SHA256 of the raw body using my organization webhook secret must equal the
   hex value in the x-onboard-signature header (strip the "sha256=" prefix). Stop if it does not match.
2. AI reasoning step: given role, department and start date, decide the list of onboarding tasks. Each
   task = { system, action, reason, confidence (0-1), sensitive (true/false) }. Systems to consider:
   Google Workspace (email account, calendar invites), Slack (channels), GitHub (repo access),
   Jira (project access), HR docs (offer letter, policy acknowledgement), Payroll, Laptop/asset request.
   Mark anything granting production, financial, or PII access as sensitive: true.
3. For every task, first POST to callbacks.task_url with status "in_progress".
4. Then branch by system and run the real action for that system.
   - If the task is sensitive or confidence < 0.7, do NOT run it. POST status "needs_human" to
     callbacks.task_url, then use a "wait for webhook" step; continue only when the approval arrives
     (payload contains decision "approved" or "rejected"). On "approved" run the action; on "rejected"
     POST status "failed" with reason "rejected by human".
5. After each action, POST the outcome to callbacks.task_url: status "completed" on success, or
   "failed" with error_message and the provider's raw response text on error. Retry a failed action up
   to 3 times with backoff and send retry_count each time.
6. Every POST to callbacks.task_url must include hire_external_id (from hire.external_id), system,
   action, and status, and be signed with HMAC-SHA256 of the raw body using the same organization
   webhook secret, sent in the x-viasocket-signature header as "sha256=<hex>".
7. Never let a step fail silently: any unhandled error must still report a "failed" task with the error
   text so the dashboard shows it.
```
