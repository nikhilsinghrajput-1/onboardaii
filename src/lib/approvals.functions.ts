import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const decisionInput = z.object({
  orgId: z.string().uuid(),
  taskId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().min(3).max(1000),
});

const orgInput = z.object({ orgId: z.string().uuid() });

const settingsInput = z.object({
  orgId: z.string().uuid(),
  slackApprovalChannel: z.string().max(120).nullable(),
  slackAlertChannel: z.string().max(120).nullable(),
  resumeUrl: z.string().url().max(500).nullable(),
});

export const decideTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => decisionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { applyDecision } = await import("./decisions.server");
    const { assertOrgMember } = await import("./connections.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    const email =
      (context.claims as { email?: string } | null)?.email ?? context.userId.slice(0, 8);
    return applyDecision({
      orgId: data.orgId,
      taskId: data.taskId,
      decision: data.decision,
      note: data.note,
      decidedBy: context.userId,
      decidedByLabel: email,
      channel: "in_app",
    });
  });

export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    const store = await import("./connections.server");
    const { loadOrgById } = await import("./org-ops.server");
    const ops = await import("./ops.server");
    await store.assertOrgMember(context.supabase as never, data.orgId, context.userId);
    const org = await loadOrgById(data.orgId);
    if (!org) throw new Error("Organization not found");
    const slackConnected =
      Boolean(await store.getOrgConnectionKey(org.id, "slack")) || ops.slackConfigured();
    return {
      slug: org.slug,
      webhookSecret: org.webhook_secret,
      slack: slackConnected,
      approvalChannel: org.slack_approval_channel,
      alertChannel: org.slack_alert_channel,
      resumeUrl: org.resume_url,
    };
  });

export const saveOrgSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsInput.parse(input))
  .handler(async ({ data, context }) => {
    const store = await import("./connections.server");
    await store.assertOrgMember(context.supabase as never, data.orgId, context.userId);
    const { error } = await context.supabase
      .from("organizations")
      .update({
        slack_approval_channel: data.slackApprovalChannel,
        slack_alert_channel: data.slackAlertChannel,
        resume_url: data.resumeUrl,
      })
      .eq("id", data.orgId);
    if (error) throw error;
    return { ok: true };
  });
