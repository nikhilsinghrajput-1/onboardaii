import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getIntegrationStatus } from "@/lib/approvals.functions";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    meta: [
      { title: "Flow wiring · Onboarding Control" },
      {
        name: "description",
        content:
          "Webhook endpoints, payload shapes, and connection status for wiring the onboarding automation flow into this dashboard.",
      },
      { property: "og:title", content: "Flow wiring" },
      {
        property: "og:description",
        content: "Endpoints and payloads the automation flow posts into this dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IntegrationsPage,
});

function Row({ label, ok, hint }: { label: string; ok: boolean; hint: string }) {
  return (
    <li className="flex flex-wrap items-center gap-3 p-4 text-sm">
      <span className={`size-2 rounded-full ${ok ? "bg-ok" : "bg-destructive"}`} />
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">{hint}</span>
      <span className="ml-auto font-mono text-xs text-muted-foreground">
        {ok ? "configured" : "missing"}
      </span>
    </li>
  );
}

function Endpoint({
  path,
  description,
  sample,
}: {
  path: string;
  description: string;
  sample: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-5">
      <p className="font-mono text-sm text-wait">POST {path}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <pre className="mt-3 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
        {sample}
      </pre>
    </div>
  );
}

function IntegrationsPage() {
  const fetchStatus = useServerFn(getIntegrationStatus);
  const status = useQuery({ queryKey: ["integration-status"], queryFn: () => fetchStatus() });
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Flow wiring</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The automation flow keeps running the reasoning, dispatch, and retries. It pushes state here
        and this dashboard pushes decisions back.
      </p>

      <ul className="mt-8 divide-y divide-border/70 rounded-xl border border-border/70 bg-card">
        <Row
          label="Webhook signing secret"
          ok={Boolean(status.data?.webhookSecret)}
          hint="Signs every inbound hire and task payload"
        />
        <Row
          label="Slack connection"
          ok={Boolean(status.data?.slack)}
          hint="Approval requests and failure alerts"
        />
        <Row
          label="Approval channel"
          ok={Boolean(status.data?.approvalChannel)}
          hint="Where Approve / Reject messages are posted"
        />
        <Row
          label="Alert channel"
          ok={Boolean(status.data?.alertChannel)}
          hint="Where failed-after-retries alerts go"
        />
        <Row
          label="Flow resume URL"
          ok={Boolean(status.data?.resumeUrl)}
          hint="Called after every human decision so the flow continues or halts"
        />
      </ul>

      <section className="mt-10 space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Endpoints
        </h2>
        <p className="text-sm text-muted-foreground">
          Sign the raw JSON body with HMAC-SHA256 using the shared secret and send it as{" "}
          <code className="font-mono text-xs">x-viasocket-signature</code>. Unsigned calls are
          rejected.
        </p>
        <Endpoint
          path={`${origin}/api/public/viasocket/hire`}
          description="Called when a new hire record is created in the HR system. Upserts on external_id."
          sample={`{
  "external_id": "WD-10044",
  "full_name": "Sam Okafor",
  "email": "sam.okafor@example.com",
  "role": "Data Engineer",
  "department": "Engineering",
  "seniority": "mid",
  "employment_type": "full_time",
  "location": "Lisbon, PT",
  "start_date": "2026-09-14",
  "pii_access": true,
  "on_call": false,
  "direct_reports": false,
  "owning_team": "Data Platform"
}`}
        />
        <Endpoint
          path={`${origin}/api/public/viasocket/task`}
          description="Called after every action step. Upserts one row per (hire, system, action). A first-time needs_human posts an approval request to Slack; a first-time failed fires the alert with the raw response attached."
          sample={`{
  "hire_external_id": "WD-10044",
  "external_task_id": "T-88",
  "system": "Okta",
  "action": "assign_pii_training_group",
  "reason": "PII access flag requires mandatory training",
  "confidence": 0.64,
  "sensitive": true,
  "status": "needs_human",
  "retry_count": 0,
  "error_message": null,
  "raw_response": null
}`}
        />
        <Endpoint
          path={`${origin}/api/public/slack/events`}
          description="Slack interactivity endpoint. Approve / Reject buttons write the same decision as the in-app queue, verified with the Slack signing secret."
          sample={`Set this URL as the Interactivity request URL on the Slack app.`}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Decision callback
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          After every approve or reject, this app POSTs to the configured flow resume URL:
        </p>
        <pre className="mt-3 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
          {`{
  "event": "approval_decision",
  "task_id": "…",
  "external_task_id": "T-88",
  "hire_external_id": "WD-10044",
  "system": "Okta",
  "action": "assign_pii_training_group",
  "decision": "approved",
  "note": "Training group is required, access itself unchanged",
  "decided_by": "ops@example.com"
}`}
        </pre>
      </section>
    </main>
  );
}
