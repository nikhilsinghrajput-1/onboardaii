import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const connectInput = z.object({
  orgId: z.string().uuid(),
  connectorId: z.string().min(1),
});

const completeInput = connectInput.extend({ code: z.string().min(1) });

/** Starts the admin-facing OAuth flow for one tool and returns the consent URL. */
export const startConnectorOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => connectInput.parse(input))
  .handler(async ({ data, context }) => {
    const store = await import("./connections.server");
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { CONNECTOR_CATALOG } = await import("./connector-catalog");
    await store.assertOrgMember(context.supabase as never, data.orgId, context.userId);

    const spec = CONNECTOR_CATALOG.find((c) => c.id === data.connectorId);
    if (!spec) throw new Error("Unknown tool.");

    const clientAPIKey = store.clientApiKeyFor(data.connectorId);
    if (!clientAPIKey) {
      throw new Error(`${spec.label} has no OAuth client configured for this project yet.`);
    }

    const request = getRequest();
    if (!request) throw new Error("Connecting must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost =
      url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL(
      `/oauth/${data.connectorId}/return`,
      sandboxHost ? `https://${sandboxHost}` : url.origin,
    ).toString();

    const existing = await store.getOrgConnectionKey(data.orgId, data.connectorId);

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: store.GATEWAY_BASE_URL,
      connectorId: data.connectorId,
      appUserId: context.userId,
      clientAPIKey,
      returnUrl,
      connectionAPIKey: existing ?? undefined,
      ...(spec.scopes ? { credentialsConfiguration: { scopes: spec.scopes } } : {}),
    });
    return { authorizationUrl };
  });

/** Exchanges the one-time code and stores the encrypted connection key. */
export const completeConnectorOAuth = createServerFn({ method: "POST" })
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

/** Revokes the stored connection at the gateway and deletes the local row. */
export const disconnectConnector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => connectInput.parse(input))
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
