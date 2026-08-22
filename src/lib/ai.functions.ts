import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const briefingInput = z.object({ orgId: z.string().uuid(), force: z.boolean().optional() });
const taskInput = z.object({ orgId: z.string().uuid(), taskId: z.string().uuid() });
const askInput = z.object({
  orgId: z.string().uuid(),
  question: z.string().trim().min(3).max(600),
});
const planInput = z.object({ orgId: z.string().uuid(), hireId: z.string().uuid() });

/** Today's AI briefing for the org, cached per day. */
export const getBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => briefingInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    const { loadOrgById } = await import("./org-ops.server");
    const { dailyBriefing } = await import("./ai.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    const org = await loadOrgById(data.orgId);
    if (!org) throw new Error("Organization not found");
    return dailyBriefing(org.id, org.name, data.force === true);
  });

/** Risk read and recommendation for one pending approval. */
export const getApprovalAdvice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => taskInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    const { approvalAdvice } = await import("./ai.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: task } = await supabaseAdmin
      .from("onboarding_tasks")
      .select("system, action, reason, confidence, hire_id")
      .eq("org_id", data.orgId)
      .eq("id", data.taskId)
      .maybeSingle();
    if (!task) throw new Error("Task not found");
    const { data: hire } = await supabaseAdmin
      .from("hires")
      .select("full_name, role, department, pii_access, on_call, direct_reports")
      .eq("id", task.hire_id)
      .maybeSingle();

    return approvalAdvice({
      hireName: (hire?.full_name as string) ?? "Unknown hire",
      role: (hire?.role as string) ?? "unknown",
      department: (hire?.department as string) ?? "unknown",
      system: task.system as string,
      action: task.action as string,
      reason: (task.reason as string | null) ?? null,
      confidence: (task.confidence as number | null) ?? null,
      piiAccess: Boolean(hire?.pii_access),
      onCall: Boolean(hire?.on_call),
      directReports: Boolean(hire?.direct_reports),
    });
  });

/** Answers a question about the live hires and tasks. */
export const askKeystone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => askInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    const { loadOrgById } = await import("./org-ops.server");
    const { askKeystoneAnswer } = await import("./ai.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    const org = await loadOrgById(data.orgId);
    if (!org) throw new Error("Organization not found");
    return askKeystoneAnswer(org.id, org.name, data.question);
  });

/** AI-proposed onboarding checklist for one hire, for human review. */
export const getProposedPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => planInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember, appConnectionKey } = await import("./connections.server");
    const { CONNECTOR_CATALOG } = await import("./connector-catalog");
    const { proposedPlan } = await import("./ai.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: hire } = await supabaseAdmin
      .from("hires")
      .select("full_name, role, department, seniority, pii_access, on_call, direct_reports")
      .eq("org_id", data.orgId)
      .eq("id", data.hireId)
      .maybeSingle();
    if (!hire) throw new Error("Hire not found");

    return proposedPlan({
      fullName: hire.full_name as string,
      role: hire.role as string,
      department: hire.department as string,
      seniority: (hire.seniority as string | null) ?? null,
      piiAccess: Boolean(hire.pii_access),
      onCall: Boolean(hire.on_call),
      directReports: Boolean(hire.direct_reports),
      connectedTools: CONNECTOR_CATALOG.filter((c) => appConnectionKey(c.id)).map((c) => c.id),
    });
  });
