import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const channelInput = z.object({
  orgId: z.string().uuid(),
  hireId: z.string().uuid(),
});

const triggerInput = z.object({
  orgId: z.string().uuid(),
  hireId: z.string().uuid(),
  appOrigin: z.string().url().max(500),
});

const newHireInput = z.object({
  orgId: z.string().uuid(),
  appOrigin: z.string().url().max(500),
  fullName: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  department: z.string().trim().max(200).optional(),
  startDate: z.string().trim().max(40).optional(),
});

export const createHireChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => channelInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    const { ensureHireChannel } = await import("./slack-channels.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    return ensureHireChannel(data.orgId, data.hireId);
  });

/** Re-runs the Slack channel access grant (#general + the hire's own channel). */
export const grantHireSlackAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => channelInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    const { grantSlackAccess } = await import("./slack-access.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    return grantSlackAccess(data.orgId, data.hireId);
  });

/**
 * Creates a hire inside the caller's organization, then provisions their
 * dedicated Slack channel and grants access to the shared channels (#general).
 */
export const createHire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => newHireInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: hire, error } = await supabaseAdmin
      .from("hires")
      .insert({
        org_id: data.orgId,
        external_id: `app-${Date.now().toString(36)}`,
        full_name: data.fullName,
        email: data.email,
        role: data.role,
        department: data.department?.trim() ? data.department : "Unassigned",
        start_date: data.startDate?.trim() ? data.startDate : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Slack provisioning is owned by the automation flow, not this app.
    // Kick off the organization's automation flow with the finished hire record.
    const { triggerHireFlow } = await import("./flow-trigger.server");
    const flow = await triggerHireFlow(data.orgId, hire.id, data.appOrigin).catch(
      (err: unknown) => ({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
    );

    return {
      hireId: hire.id as string,
      flowOk: flow.ok,
      flowError: flow.ok ? null : (flow.error ?? "Flow trigger failed"),
    };
  });

/** Re-sends the hire.created webhook to the organization's automation flow. */
export const retriggerHireFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => triggerInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    const { triggerHireFlow } = await import("./flow-trigger.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    return triggerHireFlow(data.orgId, data.hireId, data.appOrigin);
  });
