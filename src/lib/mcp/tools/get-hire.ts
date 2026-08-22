import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { resolveOrgId, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_hire_onboarding",
  title: "Get hire onboarding status",
  description:
    "Get one new hire's full onboarding detail: profile, every provisioning task with status and errors, and past approval decisions.",
  inputSchema: {
    hire_id: z.string().uuid().describe("The hire's id, from list_hires."),
  },
  outputSchema: {
    hire: z.record(z.unknown()),
    tasks: z.array(z.record(z.unknown())),
    approvals: z.array(z.record(z.unknown())),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ hire_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const orgId = await resolveOrgId(ctx);

    const { data: hire, error } = await supabase
      .from("hires")
      .select("*")
      .eq("org_id", orgId)
      .eq("id", hire_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!hire) return { content: [{ type: "text", text: "No such hire." }], isError: true };

    const { data: tasks } = await supabase
      .from("onboarding_tasks")
      .select(
        "id, system, action, reason, sensitive, status, retry_count, error_message, created_at, updated_at",
      )
      .eq("org_id", orgId)
      .eq("hire_id", hire_id)
      .order("created_at", { ascending: true });

    const taskIds = (tasks ?? []).map((t) => t.id as string);
    const { data: approvals } = taskIds.length
      ? await supabase
          .from("approvals")
          .select("id, task_id, decision, note, decided_by_label, channel, created_at")
          .eq("org_id", orgId)
          .in("task_id", taskIds)
          .order("created_at", { ascending: false })
      : { data: [] };

    const payload = { hire, tasks: tasks ?? [], approvals: approvals ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
