import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const testInput = z.object({
  endpointType: z.enum(["task-update", "hire-update"]),
  callbackUrl: z.string().min(1).max(2000),
  payload: z.record(z.string(), z.unknown()),
  headers: z.record(z.string(), z.string().max(4000)).optional(),
});

const logsInput = z.object({
  search: z.string().max(200).optional(),
  endpointType: z.enum(["task-update", "hire-update", "all"]).default("all"),
  outcome: z.enum(["all", "ok", "failed"]).default("all"),
  limit: z.number().int().min(1).max(200).default(50),
});

/** Sends a test relay delivery from the admin UI (server-side, no secret in the browser). */
export const sendTestRelay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => testInput.parse(input))
  .handler(async ({ data }) => {
    const { deliverCallback } = await import("./relay.server");
    return deliverCallback({
      endpointType: data.endpointType,
      body: {
        callback_url: data.callbackUrl,
        payload: data.payload,
        ...(data.headers ? { headers: data.headers } : {}),
      },
      source: "ui",
    });
  });

/** Recent relay deliveries with search and filters. */
export const listRelayDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => logsInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("relay_deliveries")
      .select(
        "id, endpoint_type, callback_url, callback_host, ok, status_code, attempts, error, event, hire_ref, employee_email, duration_ms, source, response_preview, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.endpointType !== "all") query = query.eq("endpoint_type", data.endpointType);
    if (data.outcome !== "all") query = query.eq("ok", data.outcome === "ok");
    if (data.search) {
      const term = `%${data.search.replace(/[%,]/g, "")}%`;
      query = query.or(
        `callback_url.ilike.${term},hire_ref.ilike.${term},event.ilike.${term},employee_email.ilike.${term}`,
      );
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Whether RELAY_SHARED_SECRET is present on the server. Never returns the value. */
export const getRelayStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { relaySecretConfigured } = await import("./relay.server");
    const allowlist = (process.env["RELAY_ALLOWED_HOSTS"] ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    return { secretConfigured: relaySecretConfigured(), allowlist };
  });
