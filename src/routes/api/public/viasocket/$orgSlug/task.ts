import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { notifyApprovalNeeded, notifyFailure, type TaskRow } from "@/lib/decisions.server";
import { loadOrgBySlug, verifyOrgSignature } from "@/lib/org-ops.server";

const taskSchema = z.object({
  hire_external_id: z.string().min(1).max(200),
  external_task_id: z.string().max(200).optional().nullable(),
  system: z.string().min(1).max(200),
  action: z.string().min(1).max(200),
  reason: z.string().max(2000).optional().nullable(),
  confidence: z.number().min(0).max(1).optional().nullable(),
  sensitive: z.boolean().optional(),
  status: z.enum(["not_started", "in_progress", "completed", "failed", "needs_human"]),
  retry_count: z.number().int().min(0).max(100).optional(),
  error_message: z.string().max(4000).optional().nullable(),
  raw_response: z.string().max(20000).optional().nullable(),
});

export const Route = createFileRoute("/api/public/viasocket/$orgSlug/task")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const raw = await request.text();
        const org = await loadOrgBySlug(params.orgSlug);
        if (!org) return Response.json({ error: "unknown organization" }, { status: 404 });
        if (
          !verifyOrgSignature(raw, request.headers.get("x-viasocket-signature"), org.webhook_secret)
        ) {
          return Response.json({ error: "invalid signature" }, { status: 401 });
        }

        let body: unknown;
        try {
          body = JSON.parse(raw);
        } catch {
          return Response.json({ error: "invalid JSON" }, { status: 400 });
        }
        const parsed = taskSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "validation failed", issues: parsed.error.issues },
            { status: 400 },
          );
        }
        const t = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: hire, error: hireError } = await supabaseAdmin
          .from("hires")
          .select("id, full_name, owning_team")
          .eq("org_id", org.id)
          .eq("external_id", t.hire_external_id)
          .maybeSingle();
        if (hireError) {
          console.error("hire lookup failed", hireError);
          return Response.json({ error: "hire lookup failed" }, { status: 500 });
        }
        if (!hire) {
          return Response.json({ error: "unknown hire_external_id" }, { status: 404 });
        }

        const { data: previous } = await supabaseAdmin
          .from("onboarding_tasks")
          .select("status")
          .eq("hire_id", hire.id)
          .eq("system", t.system)
          .eq("action", t.action)
          .maybeSingle();

        const { data: task, error } = await supabaseAdmin
          .from("onboarding_tasks")
          .upsert(
            {
              org_id: org.id,
              hire_id: hire.id,
              external_task_id: t.external_task_id ?? null,
              system: t.system,
              action: t.action,
              reason: t.reason ?? null,
              confidence: t.confidence ?? null,
              sensitive: t.sensitive ?? false,
              status: t.status,
              retry_count: t.retry_count ?? 0,
              error_message: t.error_message ?? null,
              raw_response: t.raw_response ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "hire_id,system,action" },
          )
          .select(
            "id, org_id, hire_id, system, action, reason, confidence, status, retry_count, error_message, raw_response, external_task_id",
          )
          .single();

        if (error || !task) {
          console.error("task upsert failed", error);
          return Response.json({ error: "could not store task" }, { status: 500 });
        }

        const row = task as TaskRow;
        const appUrl = new URL(request.url).origin;
        try {
          if (row.status === "needs_human" && previous?.status !== "needs_human") {
            await notifyApprovalNeeded(org, row, hire.full_name, appUrl);
          }
          if (row.status === "failed" && previous?.status !== "failed") {
            await notifyFailure(org, row, hire.full_name, hire.owning_team);
          }
        } catch (notifyError) {
          console.error("notification failed", notifyError);
        }

        return Response.json({ ok: true, task_id: row.id });
      },
    },
  },
});
