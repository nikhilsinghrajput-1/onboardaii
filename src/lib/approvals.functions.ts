import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const decisionInput = z.object({
  taskId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().min(3).max(1000),
});

export const decideTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => decisionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { applyDecision } = await import("./decisions.server");
    const email =
      (context.claims as { email?: string } | null)?.email ?? context.userId.slice(0, 8);
    const result = await applyDecision({
      taskId: data.taskId,
      decision: data.decision,
      note: data.note,
      decidedBy: context.userId,
      decidedByLabel: email,
      channel: "in_app",
    });
    return result;
  });

export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const ops = await import("./ops.server");
    return {
      webhookSecret: ops.viaSocketSecretConfigured(),
      slack: ops.slackConfigured(),
      approvalChannel: Boolean(ops.approvalChannel()),
      alertChannel: Boolean(ops.alertChannel()),
      resumeUrl: Boolean(process.env["VIASOCKET_RESUME_URL"]),
    };
  });
