import { GATEWAY_BASE_URL, appConnectionKey } from "./connections.server";

export type GatewayResult<T = unknown> = {
  ok: boolean;
  status: number;
  error: string | null;
  raw: string;
  data: T | null;
};

/**
 * One call to a connected tool through the Lovable connector gateway using the
 * workspace-level connection key. Never throws — callers turn failures into task
 * state so a missing or unhappy tool can never break a whole onboarding run.
 */
export async function gatewayCall<T = unknown>(
  connectorId: string,
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<GatewayResult<T>> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) {
    return {
      ok: false,
      status: 0,
      error: "gateway_key_missing",
      raw: "LOVABLE_API_KEY is not set",
      data: null,
    };
  }
  const connectionKey = appConnectionKey(connectorId);
  if (!connectionKey) {
    return {
      ok: false,
      status: 0,
      error: "not_connected",
      raw: `${connectorId} is not connected for this app`,
      data: null,
    };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
    ...(init.headers ?? {}),
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  try {
    const res = await fetch(`${GATEWAY_BASE_URL}/${connectorId}${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const raw = await res.text();
    if (!res.ok) {
      console.error(`Gateway ${connectorId} ${path} failed [${res.status}]: ${raw}`);
      return { ok: false, status: res.status, error: `http_${res.status}`, raw, data: null };
    }
    let data: T | null = null;
    try {
      data = raw ? (JSON.parse(raw) as T) : null;
    } catch {
      data = null;
    }
    return { ok: true, status: res.status, error: null, raw, data };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.error(`Gateway ${connectorId} ${path} threw: ${raw}`);
    return { ok: false, status: 0, error: "request_failed", raw, data: null };
  }
}

export function toolConnected(connectorId: string): boolean {
  return Boolean(appConnectionKey(connectorId));
}

/** Append one line to the Keystone activity feed. Never throws. */
export async function logActivity(input: {
  orgId: string;
  hireId?: string | null;
  tool: string;
  action: string;
  outcome: "ok" | "failed" | "skipped" | "needs_human";
  detail?: string | null;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("activity_log").insert({
      org_id: input.orgId,
      hire_id: input.hireId ?? null,
      tool: input.tool,
      action: input.action,
      outcome: input.outcome,
      detail: input.detail?.slice(0, 1000) ?? null,
    });
  } catch (error) {
    console.error("activity_log insert failed", error);
  }
}

/** Minimal hire shape the per-tool steps need. */
export type HireLite = {
  id: string;
  org_id: string;
  full_name: string;
  email: string | null;
  role: string;
  department: string;
  start_date: string | null;
  owning_team: string | null;
  slack_channel_name: string | null;
};

export type ToolStepResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string | null;
  detail?: string | null;
  /** Column updates to persist on the hire row. */
  patch?: Record<string, string | null>;
};

/** ISO datetime for the hire's first day (or tomorrow) at a given local hour. */
export function dayOneAt(startDate: string | null, hour: number): string {
  const base = startDate ? new Date(`${startDate}T00:00:00Z`) : new Date(Date.now() + 86400000);
  base.setUTCHours(hour, 0, 0, 0);
  return base.toISOString();
}
