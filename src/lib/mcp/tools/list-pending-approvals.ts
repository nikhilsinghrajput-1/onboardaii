import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { resolveOrgId, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_pending_approvals",
  title: "List pending approvals",
  description:
    "List onboarding tasks that are waiting for a human decision, with the hire they belong to.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("How many tasks to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const orgId = await resolveOrgId(ctx);

    const { data: tasks, error } = await supabase
      .from("onboarding_tasks")
      .select("id, hire_id, system, action, reason, sensitive, confidence, created_at")
      .eq("org_id", orgId)
      .eq("status", "needs_human")
      .order("created_at", { ascending: true })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const hireIds = [...new Set((tasks ?? []).map((t) => t.hire_id as string))];
    const { data: hires } = hireIds.length
      ? await supabase
          .from("hires")
          .select("id, full_name, email, role")
          .eq("org_id", orgId)
          .in("id", hireIds)
      : { data: [] as { id: string; full_name: string; email: string | null; role: string }[] };

    const rows = (tasks ?? []).map((t) => ({
      ...t,
      hire: (hires ?? []).find((h) => h.id === t.hire_id) ?? null,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { pending: rows },
    };
  },
});
