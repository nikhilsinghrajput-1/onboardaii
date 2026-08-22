import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  webhook_secret: string;
  slack_approval_channel: string | null;
  slack_alert_channel: string | null;
  resume_url: string | null;
  flow_trigger_url: string | null;
  created_at: string;
};

const ACTIVE_ORG_KEY = "onboarding-control.active-org";

export function readActiveOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_ORG_KEY);
}

export function writeActiveOrgId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ACTIVE_ORG_KEY, id);
  else window.localStorage.removeItem(ACTIVE_ORG_KEY);
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "org"
  );
}

export const orgsQuery = queryOptions({
  queryKey: ["organizations"],
  queryFn: async (): Promise<Organization[]> => {
    const { data, error } = await supabase
      .from("organizations")
      .select(
        "id, name, slug, webhook_secret, slack_approval_channel, slack_alert_channel, resume_url, flow_trigger_url, created_at",
      )
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Organization[];
  },
});

/** Creates the organization and makes the current user its owner. */
export async function createOrganization(name: string): Promise<Organization> {
  const base = slugify(name);
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase.rpc("create_organization", {
      _name: name.trim(),
      _slug: slug,
    });

    if (!error && data) return data as unknown as Organization;
    // 23505 = unique violation on slug -> retry with a suffixed slug.
    if (error && (error.code === "23505" || /duplicate key/i.test(error.message))) {
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      continue;
    }
    throw error ?? new Error("Could not create the organization.");
  }
  throw new Error("Could not find a free organization URL. Try a different name.");
}
