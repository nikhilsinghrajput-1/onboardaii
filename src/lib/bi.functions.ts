import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const hireInput = z.object({ orgId: z.string().uuid(), hireId: z.string().uuid() });
const briefInput = hireInput.extend({ force: z.boolean().optional() });
const ingestInput = hireInput.extend({
  source: z.enum(["github", "slack", "jira"]),
  metrics: z.record(z.string().max(60), z.number()),
});

/** Recaptures GitHub, Slack and Jira signals for one employee. */
export const refreshSignals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => hireInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    const { syncSignals } = await import("./bi.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    return syncSignals(data.orgId, data.hireId);
  });

/** AI performance brief for one employee. */
export const getPerformanceBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => briefInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    const { performanceBrief } = await import("./bi.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    return performanceBrief(data.orgId, data.hireId, data.force === true);
  });

/** Pushes real metrics for one source (e.g. exported from GitHub or Jira). */
export const pushSignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ingestInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    const { ingestSignal } = await import("./bi.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    return ingestSignal(data.orgId, data.hireId, data.source, data.metrics);
  });
