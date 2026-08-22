import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const channelInput = z.object({
  orgId: z.string().uuid(),
  hireId: z.string().uuid(),
});

const runInput = z.object({
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
 * Creates a hire and runs the onboarding right here, using Acropolis's own
 * connected tools: Slack channel + invites, Gmail welcome mail, task checklist,
 * and approval requests for anything sensitive.
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

    const { runOnboarding } = await import("./onboarding-runner.server");
    const run = await runOnboarding(data.orgId, hire.id as string, data.appOrigin).catch(
      (err: unknown) => ({
        ok: false,
        created: 0,
        completed: 0,
        failed: 0,
        needsApproval: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      }),
    );

    return { hireId: hire.id as string, run };
  });

/** Re-runs the whole onboarding for one hire (idempotent per task). */
export const runHireOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => runInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    const { runOnboarding } = await import("./onboarding-runner.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    return runOnboarding(data.orgId, data.hireId, data.appOrigin);
  });
