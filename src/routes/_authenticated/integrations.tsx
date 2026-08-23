import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getIntegrationStatus, saveOrgSettings } from "@/lib/approvals.functions";
import { listOrgConnections } from "@/lib/connections.functions";
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
          "Connect Acropolis's Slack and Gmail, set the approval and alert channels, and manage who has access to the onboarding tool.",
      },
      { property: "og:title", content: "Wiring · Acropolis Onboarding" },
      {
        property: "og:description",
        content: "Connect Slack and Gmail, set channels, and manage Acropolis members.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IntegrationsPage,
});


function IntegrationsPage() {
  const { activeOrg, isOwner } = useOrgContext();
  const orgId = activeOrg?.id;
  const queryClient = useQueryClient();


  const fetchStatus = useServerFn(getIntegrationStatus);
  const fetchConnections = useServerFn(listOrgConnections);
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
  const [pendingConnector, setPendingConnector] = useState<string | null>(null);

  const startOAuth = useServerFn(startConnectorOAuth);
  const completeOAuth = useServerFn(completeConnectorOAuth);
  const revokeOAuth = useServerFn(disconnectConnector);

  const connectMutation = useMutation({
    mutationFn: async (connectorId: string) => {
      const popup = window.open("", "keystone-oauth", "width=600,height=760");
      if (!popup) throw new Error("Allow popups for this site and try again.");
      setPendingConnector(connectorId);
      try {
        const { authorizationUrl } = await startOAuth({ data: { orgId: orgId!, connectorId } });
        const completion = waitForOAuthCompletion(popup, connectorId);
        popup.location.href = authorizationUrl;
        const code = await completion;
        if (code) await completeOAuth({ data: { orgId: orgId!, connectorId, code } });
      } catch (error) {
        popup.close();
        throw error;
      } finally {
        setPendingConnector(null);
      }
    },
    onSuccess: () => {
      toast.success("Connected.");
      void queryClient.invalidateQueries({ queryKey: ["org-connections", orgId] });
      void queryClient.invalidateQueries({ queryKey: ["integration-status", orgId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not finish connecting."),
  });

  const disconnectMutation = useMutation({
    mutationFn: (connectorId: string) => revokeOAuth({ data: { orgId: orgId!, connectorId } }),
    onSuccess: () => {
      toast.success("Disconnected.");
      void queryClient.invalidateQueries({ queryKey: ["org-connections", orgId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not disconnect."),
  });

  

  useEffect(() => {
    if (!status.data) return;
    setApproval(status.data.approvalChannel ?? "");
    setAlert(status.data.alertChannel ?? "");
  }, [status.data]);

  const settingsMutation = useMutation({
    mutationFn: () =>
      saveSettings({
        data: {
          orgId: orgId!,
          slackApprovalChannel: approval.trim() || null,
          slackAlertChannel: alert.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Saved.");
      void queryClient.invalidateQueries({ queryKey: ["integration-status", orgId] });
      void queryClient.invalidateQueries({ queryKey: ["organization"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not save those settings."),
  });

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Wiring</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Acropolis's tools are connected once for the whole workspace — no per-person sign-in. This
        app runs the onboarding itself: it opens the Slack channel, invites the hire, sends the
        welcome email from Gmail, builds the checklist, and asks for approval on anything sensitive.
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Your tools
        </h2>
        {connections.isLoading && <Skeleton className="mt-3 h-32 w-full" />}
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {CONNECTOR_CATALOG.map((spec) => {
            const row = connections.data?.find((c) => c.id === spec.id);
            const connected = Boolean(row?.connected);
            const viaOAuth = Boolean(row?.oauthConnected);
            const canOAuth = Boolean(row?.oauthAvailable);
            return (
              <li key={spec.id} className="rounded-xl border border-border/70 bg-card p-5">
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${connected ? "bg-ok" : "bg-muted-foreground/40"}`}
                  />
                  <span className="font-medium">{spec.label}</span>
                  <span
                    className={`ml-auto text-xs ${connected ? "text-ok" : "text-muted-foreground"}`}
                  >
                    {viaOAuth ? "connected by admin" : connected ? "active" : "not connected"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{spec.blurb}</p>
                {canOAuth && (
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={viaOAuth ? "outline" : "default"}
                      disabled={!orgId || pendingConnector === spec.id}
                      onClick={() => connectMutation.mutate(spec.id)}
                    >
                      {pendingConnector === spec.id
                        ? "Opening…"
                        : viaOAuth
                          ? `Reconnect ${spec.label}`
                          : `Connect ${spec.label}`}
                    </Button>
                    {viaOAuth && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!orgId || disconnectMutation.isPending}
                        onClick={() => disconnectMutation.mutate(spec.id)}
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Connect a tool here to sign in with your own account — Keystone then acts inside that
          workspace. Tools without a sign-in button run on the shared workspace connection.
        </p>
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
          Slack interactivity
        </h2>
        <p className="text-sm text-muted-foreground">
          Onboarding runs entirely inside this app — there are no inbound automation webhooks any
          more. The only endpoint Slack needs is the interactivity URL below, so the Approve and
          Reject buttons write the same decision as the in-app queue.
        </p>
        <div className="rounded-xl border border-border/70 bg-card p-5">
          <p className="font-mono text-sm break-all text-wait">{origin}/api/public/slack/events</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Set this as the Interactivity request URL on the Slack app.
          </p>
        </div>
      </section>

    </main>
  );
}
