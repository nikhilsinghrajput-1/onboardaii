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

export type Member = {
  id: string;
  org_id: string;
  user_id: string | null;
  email: string | null;
  role: "owner" | "member";
  created_at: string;
};

const ORG_COLUMNS =
  "id, name, slug, webhook_secret, slack_approval_channel, slack_alert_channel, resume_url, flow_trigger_url, created_at";

/** This is a single-organization, internal-only workspace: there is exactly one row. */
export const orgQuery = queryOptions({
  queryKey: ["organization"],
  queryFn: async (): Promise<Organization | null> => {
    // Claim a pending invite (matched on email) before reading, so a first sign-in works.
    await supabase.rpc("claim_membership");
    const { data, error } = await supabase.from("organizations").select(ORG_COLUMNS).maybeSingle();
    if (error) throw error;
    return (data as Organization | null) ?? null;
  },
});

export const membersQuery = queryOptions({
  queryKey: ["organization-members"],
  queryFn: async (): Promise<Member[]> => {
    const { data, error } = await supabase
      .from("organization_members")
      .select("id, org_id, user_id, email, role, created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Member[];
  },
});

export async function addMember(orgId: string, email: string, role: "owner" | "member") {
  const { error } = await supabase
    .from("organization_members")
    .insert({ org_id: orgId, email: email.trim().toLowerCase(), role });
  if (error) {
    if (error.code === "23505") throw new Error("That email already has access.");
    throw error;
  }
}

export async function removeMember(id: string) {
  const { error } = await supabase.from("organization_members").delete().eq("id", id);
  if (error) throw error;
}

export async function setMemberRole(id: string, role: "owner" | "member") {
  const { error } = await supabase.from("organization_members").update({ role }).eq("id", id);
  if (error) throw error;
}
