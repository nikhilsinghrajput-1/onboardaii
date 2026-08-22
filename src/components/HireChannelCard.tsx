import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createHireChannel, grantHireSlackAccess, retriggerHireFlow } from "@/lib/hires.functions";
import type { Hire } from "@/lib/dashboard-data";

export function HireChannelCard({ hire, orgId }: { hire: Hire; orgId: string | undefined }) {
  const queryClient = useQueryClient();
  const run = useServerFn(createHireChannel);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("No active organization");
      return run({ data: { orgId, hireId: hire.id } });
    },
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(`Slack channel #${result.channelName} is ready`);
      } else {
        toast.error(result.error ?? "Slack channel could not be created");
      }
      void queryClient.invalidateQueries({ queryKey: ["hires"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Slack channel could not be created");
    },
  });

  const runAccess = useServerFn(grantHireSlackAccess);
  const access = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("No active organization");
      return runAccess({ data: { orgId, hireId: hire.id } });
    },
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(`Access granted: #${result.channels.join(", #")}`);
      } else {
        toast.error(result.error ?? "Slack access could not be granted");
      }
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Slack access could not be granted");
    },
  });

  const runFlow = useServerFn(retriggerHireFlow);
  const flow = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("No active organization");
      return runFlow({ data: { orgId, hireId: hire.id, appOrigin: window.location.origin } });
    },
    onSuccess: (result) => {
      if (result.ok) toast.success("Automation flow triggered");
      else toast.error(result.error ?? "Flow could not be triggered");
      void queryClient.invalidateQueries({ queryKey: ["hires"] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Flow could not be triggered");
    },
  });

  return (
    <>
    <section className="mt-6 rounded-xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Slack onboarding channel
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => access.mutate()}
          disabled={access.isPending}
        >
          {access.isPending ? "Granting…" : "Grant #general access"}
        </Button>
        <div className="ml-auto">
          {hire.slack_channel_id ? (
            <span className="rounded-full border border-ok/40 bg-ok/10 px-3 py-1 text-xs text-ok">
              #{hire.slack_channel_name}
            </span>
          ) : (
            <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create Slack channel"}
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {hire.slack_channel_id
          ? "Provisioning updates and approval requests for this hire post into this channel."
          : "Creates a dedicated channel in this organization's connected Slack workspace and posts the onboarding kickoff message."}
      </p>
      {hire.slack_channel_error && !hire.slack_channel_id && (
        <p className="mt-2 text-sm text-destructive">{hire.slack_channel_error}</p>
      )}
    </section>
  );
}
