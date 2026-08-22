import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

import { resolveOrgId, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_hires",
  title: "List new hires",
  description:
    "List new hires with their onboarding task counts (completed, failed, waiting on approval).",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("How many hires to return."),
    search: z.string().trim().max(200).optional().describe("Filter by name or email."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, search }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const orgId = await resolveOrgId(ctx);

    let query = supabase
      .from("hires")
      .select("id, full_name, email, role, department, start_date, slack_channel_name, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (search) query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data: hires, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const ids = (hires ?? []).map((h) => h.id as string);
    const { data: tasks } = ids.length
      ? await supabase
          .from("onboarding_tasks")
          .select("hire_id, status")
          .eq("org_id", orgId)
          .in("hire_id", ids)
      : { data: [] as { hire_id: string; status: string }[] };

    const rows = (hires ?? []).map((h) => {
      const mine = (tasks ?? []).filter((t) => t.hire_id === h.id);
      return {
        ...h,
        tasks: {
          total: mine.length,
          completed: mine.filter((t) => t.status === "completed").length,
          failed: mine.filter((t) => t.status === "failed").length,
          needs_approval: mine.filter((t) => t.status === "needs_human").length,
        },
      };
    });

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { hires: rows },
    };
  },
});
