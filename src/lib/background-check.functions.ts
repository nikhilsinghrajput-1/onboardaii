import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const openInput = z.object({ orgId: z.string().uuid(), hireId: z.string().uuid() });
const verifyInput = z.object({ orgId: z.string().uuid(), checkId: z.string().uuid() });
const decideInput = z.object({
  orgId: z.string().uuid(),
  claimId: z.string().uuid(),
  verdict: z.enum(["pending", "verified", "unverified", "discrepancy"]),
  finding: z.string().trim().max(600).optional(),
});
const addInput = z.object({
  orgId: z.string().uuid(),
  checkId: z.string().uuid(),
  category: z.string().trim().min(2).max(40),
  claim: z.string().trim().min(3).max(600),
  evidence: z.string().trim().max(4000).optional(),
});
const evidenceInput = z.object({
  orgId: z.string().uuid(),
  claimId: z.string().uuid(),
  evidence: z.string().trim().min(1).max(4000),
});

/** Opens (or returns) the background check for one hire. */
export const openBackgroundCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => openInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    const { ensureCheck } = await import("./background-check.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    return ensureCheck(data.orgId, data.hireId, context.userId);
  });

/** Runs the AI verification pass over every claim on a check. */
export const runVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => verifyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    const { verifyCheck } = await import("./background-check.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    return verifyCheck(data.orgId, data.checkId);
  });

/** Human decision on a single claim. */
export const decideBackgroundClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => decideInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    const { decideClaim } = await import("./background-check.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    return decideClaim(
      data.orgId,
      data.claimId,
      data.verdict,
      data.finding ?? null,
      context.userId,
    );
  });

/** Adds a new claim to an open check. */
export const addBackgroundClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    const { addClaim } = await import("./background-check.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    return addClaim(data.orgId, data.checkId, data.category, data.claim, data.evidence ?? null);
  });

/** Attaches evidence text to a claim and resets it for review. */
export const attachClaimEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => evidenceInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    const { setEvidence } = await import("./background-check.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    return setEvidence(data.orgId, data.claimId, data.evidence);
  });
