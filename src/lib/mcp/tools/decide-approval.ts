import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { resolveOrgId } from "../supabase";

export default defineTool({
  name: "decide_approval",
  title: "Approve or reject a task",
  description:
    "Record an approve/reject decision on an onboarding task that needs a human. Approved tasks continue provisioning; rejected tasks are marked failed.",
  inputSchema: {
    task_id: z.string().uuid().describe("Task id from list_pending_approvals."),
    decision: z.enum(["approved", "rejected"]).describe("The decision to record."),
    note: z.string().trim().min(3).max(1000).describe("Short reason for the decision."),
  },
  outputSchema: { result: z.record(z.unknown()) },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ task_id, decision, note }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const orgId = await resolveOrgId(ctx);
    const { applyDecision } = await import("@/lib/decisions.server");

    const result = await applyDecision({
      orgId,
      taskId: task_id,
      decision,
      note,
      decidedBy: ctx.getUserId() ?? null,
      decidedByLabel: ctx.getUserEmail() ?? "agent",
      channel: "in_app",
    }).catch((error: unknown) => {
      throw new ToolError(error instanceof Error ? error.message : String(error));
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: { result },
    };
  },
});
