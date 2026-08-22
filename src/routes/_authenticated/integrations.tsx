import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { waitForOAuthCompletion } from "@/lib/appUserConnectorClient";
import { getIntegrationStatus, saveOrgSettings } from "@/lib/approvals.functions";
import {
  completeOrgConnection,
  disconnectOrgConnection,
  listOrgConnections,
  startOrgConnection,
} from "@/lib/connections.functions";
import { CONNECTOR_CATALOG } from "@/lib/connector-catalog";
import { MembersCard } from "@/components/MembersCard";
import { useOrgContext } from "@/lib/org-context";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({
    meta: [
      { title: "Wiring · Acropolis Onboarding" },
      {
        name: "description",
        content:
          "Connect Acropolis's tools, set the approval and alert channels, manage who has access, and copy the signed webhook endpoints the automation posts into.",
      },
      { property: "og:title", content: "Wiring · Acropolis Onboarding" },
      {
        property: "og:description",
        content: "Connect tools, manage members, and copy the Acropolis webhook endpoints.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IntegrationsPage,
});


function Endpoint({ path, description, sample }: { path: string; description: string; sample: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-5">
      <p className="font-mono text-sm break-all text-wait">POST {path}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <pre className="mt-3 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
        {sample}
      </pre>
    </div>
  );
}

function IntegrationsPage() {
  const { activeOrg, isOwner } = useOrgContext();
  const orgId = activeOrg?.id;
  const queryClient = useQueryClient();


  const fetchStatus = useServerFn(getIntegrationStatus);
  const fetchConnections = useServerFn(listOrgConnections);
  const startConnect = useServerFn(startOrgConnection);
  const completeConnect = useServerFn(completeOrgConnection);
  const removeConnect = useServerFn(disconnectOrgConnection);
  const saveSettings = useServerFn(saveOrgSettings);

  const status = useQuery({
    queryKey: ["integration-status", orgId],
    enabled: Boolean(orgId),
    queryFn: () => fetchStatus({ data: { orgId: orgId! } }),
  });
  const connections = useQuery({
    queryKey: ["org-connections", orgId],
    enabled: Boolean(orgId),
    queryFn: () => fetchConnections({ data: { orgId: orgId! } }),
  });

  const [approval, setApproval] = useState("");
  const [alert, setAlert] = useState("");
  const [resume, setResume] = useState("");
  const [trigger, setTrigger] = useState("");
  const [busyConnector, setBusyConnector] = useState<string | null>(null);

  useEffect(() => {
    if (!status.data) return;
    setApproval(status.data.approvalChannel ?? "");
    setAlert(status.data.alertChannel ?? "");
    setResume(status.data.resumeUrl ?? "");
    setTrigger(status.data.flowTriggerUrl ?? "");
  }, [status.data]);

  const settingsMutation = useMutation({
    mutationFn: () =>
      saveSettings({
        data: {
          orgId: orgId!,
          slackApprovalChannel: approval.trim() || null,
          slackAlertChannel: alert.trim() || null,
          resumeUrl: resume.trim() || null,
          flowTriggerUrl: trigger.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Saved.");
      void queryClient.invalidateQueries({ queryKey: ["integration-status", orgId] });
      void queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save those settings."),
  });

  async function connect(connectorId: string) {
    if (!orgId) return;
    setBusyConnector(connectorId);
    const popup = window.open("", "lovable-oauth", "width=600,height=720");
    if (!popup) {
      setBusyConnector(null);
      toast.error("Allow popups for this site and try again.");
      return;
    }
    try {
      const { authorizationUrl } = await startConnect({ data: { orgId, connectorId } });
      const completion = waitForOAuthCompletion(popup, connectorId);
      popup.location.href = authorizationUrl;
      const code = await completion;
      if (code) await completeConnect({ data: { orgId, connectorId, code } });
      toast.success("Connected.");
      await queryClient.invalidateQueries({ queryKey: ["org-connections", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["integration-status", orgId] });
    } catch (error) {
      popup.close();
      toast.error(error instanceof Error ? error.message : "Could not connect that tool.");
    } finally {
      setBusyConnector(null);
    }
  }

  async function disconnect(connectorId: string) {
    if (!orgId) return;
    setBusyConnector(connectorId);
    try {
      await removeConnect({ data: { orgId, connectorId } });
      toast.success("Disconnected.");
      await queryClient.invalidateQueries({ queryKey: ["org-connections", orgId] });
      await queryClient.invalidateQueries({ queryKey: ["integration-status", orgId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect that tool.");
    } finally {
      setBusyConnector(null);
    }
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Wiring</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Acropolis connects its tools here. The automation keeps running the reasoning, dispatch, and
        retries — it pushes state into the endpoints below and this dashboard pushes decisions back.
      </p>


      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Your tools
        </h2>
        {connections.isLoading && <Skeleton className="mt-3 h-32 w-full" />}
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {CONNECTOR_CATALOG.map((spec) => {
            const state = connections.data?.find((c) => c.id === spec.id);
            const connected = Boolean(state?.connected);
            const available = state?.available ?? true;
            return (
              <li key={spec.id} className="rounded-xl border border-border/70 bg-card p-5">
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${connected ? "bg-ok" : "bg-muted-foreground/40"}`}
                  />
                  <span className="font-medium">{spec.label}</span>
                  {connected && <span className="ml-auto text-xs text-ok">connected</span>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{spec.blurb}</p>
                <div className="mt-4">
                  {connected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyConnector === spec.id}
                      onClick={() => void disconnect(spec.id)}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={busyConnector === spec.id || !available}
                      onClick={() => void connect(spec.id)}
                    >
                      {busyConnector === spec.id ? "Connecting…" : "Connect"}
                    </Button>
                  )}
                  {!connected && !available && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Not enabled for this app yet.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12 rounded-xl border border-border/70 bg-card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Notifications and callbacks
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-muted-foreground">Approval channel ID</span>
            <Input
              className="mt-1"
              value={approval}
              onChange={(e) => setApproval(e.target.value)}
              placeholder="C0123456789"
            />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Alert channel ID</span>
            <Input
              className="mt-1"
              value={alert}
              onChange={(e) => setAlert(e.target.value)}
              placeholder="C0987654321"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-muted-foreground">Flow resume URL</span>
            <Input
              className="mt-1"
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="https://flow.viasocket.com/hooks/…"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-muted-foreground">Flow trigger URL</span>
            <Input
              className="mt-1"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder="https://flow.viasocket.com/hooks/…"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              Called whenever someone adds a hire in this app. The body is signed with this
              organization&apos;s signing secret and sent as{" "}
              <code className="font-mono">x-onboard-signature</code>.
            </span>
          </label>
        </div>
        <Button
          className="mt-4"
          size="sm"
          disabled={!orgId || settingsMutation.isPending}
          onClick={() => settingsMutation.mutate()}
        >
          {settingsMutation.isPending ? "Saving…" : "Save"}
        </Button>
      </section>

      <MembersCard orgId={orgId} canManage={isOwner} />

      <section className="mt-12 space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Endpoints
        </h2>
        <p className="text-sm text-muted-foreground">
          Sign the raw JSON body with HMAC-SHA256 using the signing secret below and send it as{" "}
          <code className="font-mono text-xs">x-viasocket-signature</code>. Unsigned calls are
          rejected.
        </p>
        <div className="rounded-xl border border-border/70 bg-card p-5">
          <p className="text-sm text-muted-foreground">Signing secret</p>
          <p className="mt-1 font-mono text-xs break-all">
            {status.data?.webhookSecret ?? "loading…"}
          </p>
        </div>
        <Endpoint
          path={`${origin}/api/public/onboarding/hire`}
          description="Called when a new hire record is created. Upserts on external_id."

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
          path={`${origin}/api/public/viasocket/${slug}/task`}
          description="Called after every action step. A first-time needs_human posts an approval request; a first-time failed fires the alert with the raw response attached."
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
          description="Slack interactivity endpoint. Approve / Reject buttons write the same decision as the in-app queue."
          sample={`Set this URL as the Interactivity request URL on the Slack app.`}
        />
      </section>
    </main>
  );
}
