import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const GATEWAY_BASE_URL =
  process.env["CONNECTOR_GATEWAY_BASE_URL"] ?? "https://connector-gateway.lovable.dev";

function cryptoKey(): Buffer {
  const raw = process.env["APP_USER_CONNECTION_KEY_SECRET"];
  if (!raw) throw new Error("APP_USER_CONNECTION_KEY_SECRET is not set");
  return Buffer.from(raw, "base64");
}

export function encryptConnectionKey(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cryptoKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptConnectionKey(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", cryptoKey(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

/** Env var holding the workspace OAuth client key for a connector, if provisioned. */
export function clientApiKeyFor(connectorId: string): string | undefined {
  return process.env[`${connectorId.toUpperCase()}_APP_USER_CONNECTOR_CLIENT_API_KEY`];
}

/**
 * Key for the app-level (workspace) connection linked to this project, e.g.
 * SLACK_API_KEY / GOOGLE_MAIL_API_KEY. Single-tenant: Acropolis's own accounts
 * are connected once in Lovable, so no per-user OAuth is needed.
 */
export function appConnectionKey(connectorId: string): string | undefined {
  const base = connectorId.toUpperCase();
  for (const name of [`${base}_API_KEY`, `${base}_API_KEY_1`, `${base}_API_KEY_2`]) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

export async function saveOrgConnection(
  orgId: string,
  connectorId: string,
  connectionAPIKey: string,
  userId: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("org_connections").upsert(
    {
      org_id: orgId,
      connector_id: connectorId,
      connection_key_ciphertext: encryptConnectionKey(connectionAPIKey),
      connected_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,connector_id" },
  );
  if (error) throw error;
}

export async function getOrgConnectionKey(
  orgId: string,
  connectorId: string,
): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("org_connections")
    .select("connection_key_ciphertext")
    .eq("org_id", orgId)
    .eq("connector_id", connectorId)
    .maybeSingle();
  if (error) throw error;
  return data ? decryptConnectionKey(data.connection_key_ciphertext) : null;
}

export async function listOrgConnectorIds(orgId: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("org_connections")
    .select("connector_id")
    .eq("org_id", orgId);
  if (error) throw error;
  return (data ?? []).map((r) => r.connector_id);
}

export async function deleteOrgConnection(orgId: string, connectorId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("org_connections")
    .delete()
    .eq("org_id", orgId)
    .eq("connector_id", connectorId);
  if (error) throw error;
}

/** Throws unless the signed-in user belongs to the organization. */
export async function assertOrgMember(
  supabase: {
    from: (table: "organization_members") => {
      select: (cols: string) => {
        eq: (
          col: string,
          value: string,
        ) => {
          eq: (col: string, value: string) => { maybeSingle: () => Promise<{ data: unknown }> };
        };
      };
    };
  },
  orgId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("organization_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("You do not have access to this organization.");
}
