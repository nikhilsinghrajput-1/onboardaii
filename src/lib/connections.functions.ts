import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ orgId: z.string().uuid() });

/**
 * Single-tenant wiring status. Acropolis's tools are connected once at the app
 * level in Lovable, so a tool is live as soon as its connection key is present —
 * no per-user OAuth step.
 */
export const listOrgConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    const store = await import("./connections.server");
    const { CONNECTOR_CATALOG } = await import("./connector-catalog");
    await store.assertOrgMember(context.supabase as never, data.orgId, context.userId);
    const orgConnected = new Set(await store.listOrgConnectorIds(data.orgId));
    return CONNECTOR_CATALOG.map((spec) => {
      const workspace = Boolean(store.appConnectionKey(spec.id));
      const oauth = orgConnected.has(spec.id);
      return {
        id: spec.id,
        connected: workspace || oauth,
        oauthConnected: oauth,
        oauthAvailable: Boolean(store.clientApiKeyFor(spec.id)),
        source: oauth ? ("oauth" as const) : workspace ? ("workspace" as const) : ("none" as const),
      };
    });
  });
