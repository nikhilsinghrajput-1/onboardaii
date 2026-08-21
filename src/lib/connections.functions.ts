import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ orgId: z.string().uuid() });
const connectorInput = orgInput.extend({ connectorId: z.string().min(1).max(60) });
const completeInput = connectorInput.extend({ code: z.string().min(1).max(2000) });

export const listOrgConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => orgInput.parse(input))
  .handler(async ({ data, context }) => {
    const store = await import("./connections.server");
    const { CONNECTOR_CATALOG } = await import("./connector-catalog");
    await store.assertOrgMember(context.supabase as never, data.orgId, context.userId);
    const connected = new Set(await store.listOrgConnectorIds(data.orgId));
    return CONNECTOR_CATALOG.map((spec) => ({
      id: spec.id,
      connected: connected.has(spec.id),
      available: Boolean(store.clientApiKeyFor(spec.id)),
    }));
  });

export const startOrgConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => connectorInput.parse(input))
  .handler(async ({ data, context }) => {
    const store = await import("./connections.server");
    const { CONNECTOR_CATALOG } = await import("./connector-catalog");
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");

    await store.assertOrgMember(context.supabase as never, data.orgId, context.userId);
    const spec = CONNECTOR_CATALOG.find((c) => c.id === data.connectorId);
    if (!spec) throw new Error("Unknown tool.");
    const clientAPIKey = store.clientApiKeyFor(spec.id);
    if (!clientAPIKey) {
      throw new Error(
        `${spec.label} is not set up for this app yet. The app owner has to register the ${spec.label} OAuth client first.`,
      );
    }

    const request = getRequest();
    if (!request) throw new Error("Connections must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost =
      url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL(
      `/oauth/${spec.id}/return`,
      sandboxHost ? `https://${sandboxHost}` : url.origin,
    ).toString();

    const existing = await store.getOrgConnectionKey(data.orgId, spec.id);
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: store.GATEWAY_BASE_URL,
      connectorId: spec.id,
      appUserId: data.orgId,
      clientAPIKey,
      returnUrl,
      connectionAPIKey: existing ?? undefined,
      credentialsConfiguration: spec.scopes ? { scopes: spec.scopes } : undefined,
    });
    return { authorizationUrl };
  });

export const completeOrgConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => completeInput.parse(input))
  .handler(async ({ data, context }) => {
    const store = await import("./connections.server");
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    await store.assertOrgMember(context.supabase as never, data.orgId, context.userId);

    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      store.GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== data.connectorId) {
      throw new Error("The connection came back for a different tool.");
    }
    await store.saveOrgConnection(data.orgId, connectorId, connectionAPIKey, context.userId);
    return { ok: true };
  });

export const disconnectOrgConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => connectorInput.parse(input))
  .handler(async ({ data, context }) => {
    const store = await import("./connections.server");
    const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
    await store.assertOrgMember(context.supabase as never, data.orgId, context.userId);

    const key = await store.getOrgConnectionKey(data.orgId, data.connectorId);
    if (key) {
      try {
        await disconnectAppUser({
          gatewayBaseUrl: store.GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: data.connectorId,
        });
      } catch (error) {
        console.error("gateway disconnect failed", error);
      }
    }
    await store.deleteOrgConnection(data.orgId, data.connectorId);
    return { ok: true };
  });
