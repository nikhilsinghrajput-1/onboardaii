import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const candidateInput = z.object({
  orgId: z.string().uuid(),
  appOrigin: z.string().url().max(500),
  fullName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  role: z.string().trim().min(1).max(200),
  department: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const trackInput = z.object({
  orgId: z.string().uuid(),
  role: z.string().trim().min(1).max(200),
  department: z.string().trim().max(200).optional(),
});

const inviteInput = z.object({
  orgId: z.string().uuid(),
  candidateId: z.string().uuid(),
  appOrigin: z.string().url().max(500),
});

const submitInput = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        choiceIndex: z.number().int().min(0).max(20).nullable().optional(),
        text: z.string().max(5000).optional(),
      }),
    )
    .max(30),
});

const progressInput = z.object({
  moduleItemId: z.string().uuid(),
  done: z.boolean(),
});

/** Staff: creates the candidate account, assigns a role track and emails the invite. */
export const createCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => candidateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    const { onboardCandidate } = await import("./candidates.server");
    return onboardCandidate({
      orgId: data.orgId,
      appOrigin: data.appOrigin,
      fullName: data.fullName,
      email: data.email.toLowerCase(),
      role: data.role,
      department: data.department?.trim() ? data.department : "Unassigned",
      notes: data.notes ?? null,
      createdBy: context.userId,
    });
  });

/** Staff: (re)drafts an AI module track for a role. */
export const generateTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => trackInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    const { createTrackForRole } = await import("./candidates.server");
    return createTrackForRole(
      data.orgId,
      data.role,
      data.department?.trim() ? data.department : "Unassigned",
      context.userId,
      true,
    );
  });

/** Staff: sends the invite email again with a fresh temporary password. */
export const resendCandidateInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertOrgMember } = await import("./connections.server");
    await assertOrgMember(context.supabase as never, data.orgId, context.userId);
    const { resendInvite } = await import("./candidates.server");
    return resendInvite(data.orgId, data.candidateId, data.appOrigin);
  });

/** Candidate: everything they need for the portal (correct answers stripped out). */
export const getMyModules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadCandidateSpace } = await import("./candidates.server");
    return loadCandidateSpace(context.userId);
  });

/** Candidate: marks one module complete or incomplete. */
export const setModuleProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => progressInput.parse(input))
  .handler(async ({ data, context }) => {
    const { markProgress } = await import("./candidates.server");
    return markProgress(context.userId, data.moduleItemId, data.done);
  });

/** Candidate: submits the assessment; MCQs auto-score, written answers are AI graded. */
export const submitAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => submitInput.parse(input))
  .handler(async ({ data, context }) => {
    const { gradeSubmission } = await import("./candidates.server");
    return gradeSubmission(context.userId, data.answers);
  });
