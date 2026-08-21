import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { loadOrgBySlug, verifyOrgSignature } from "@/lib/org-ops.server";

const hireSchema = z.object({
  external_id: z.string().min(1).max(200),
  full_name: z.string().min(1).max(200),
  email: z.string().email().max(320).optional().nullable(),
  role: z.string().min(1).max(200),
  department: z.string().min(1).max(200),
  seniority: z.string().max(100).optional().nullable(),
  employment_type: z.string().max(100).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  start_date: z.string().max(40).optional().nullable(),
  pii_access: z.boolean().optional(),
  on_call: z.boolean().optional(),
  direct_reports: z.boolean().optional(),
  owning_team: z.string().max(200).optional().nullable(),
});

export const Route = createFileRoute("/api/public/viasocket/$orgSlug/hire")({
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

        let parsedBody: unknown;
        try {
          parsedBody = JSON.parse(raw);
        } catch {
          return Response.json({ error: "invalid JSON" }, { status: 400 });
        }
        const parsed = hireSchema.safeParse(parsedBody);
        if (!parsed.success) {
          return Response.json(
            { error: "validation failed", issues: parsed.error.issues },
            { status: 400 },
          );
        }
        const hire = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("hires")
          .upsert(
            {
              org_id: org.id,
              external_id: hire.external_id,
              full_name: hire.full_name,
              email: hire.email ?? null,
              role: hire.role,
              department: hire.department,
              seniority: hire.seniority ?? null,
              employment_type: hire.employment_type ?? null,
              location: hire.location ?? null,
              start_date: hire.start_date ?? null,
              pii_access: hire.pii_access ?? false,
              on_call: hire.on_call ?? false,
              direct_reports: hire.direct_reports ?? false,
              owning_team: hire.owning_team ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "org_id,external_id" },
          )
          .select("id")
          .single();

        if (error) {
          console.error("hire upsert failed", error);
          return Response.json({ error: "could not store hire" }, { status: 500 });
        }

        // Give every new hire a dedicated Slack channel in the org's own workspace.
        const { ensureHireChannel } = await import("@/lib/slack-channels.server");
        const channel = await ensureHireChannel(org.id, data.id).catch((err: unknown) => {
          console.error("hire channel provisioning threw", err);
          return null;
        });

        return Response.json({
          ok: true,
          hire_id: data.id,
          slack_channel: channel?.channelName ?? null,
          slack_channel_error: channel?.error ?? null,
        });
      },
    },
  },
});
