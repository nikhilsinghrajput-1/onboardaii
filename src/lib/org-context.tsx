import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { orgQuery, type Organization } from "@/lib/orgs";

type OrgContextValue = {
  /** The one and only organization this internal tool serves. */
  activeOrg: Organization | null;
  isLoading: boolean;
  error: unknown;
  /** Null while unknown; false when the signed-in user has not been given access. */
  isMember: boolean | null;
  isOwner: boolean;
  userEmail: string | null;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const org = useQuery(orgQuery);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUserEmail(data.user?.email ?? null);
      setUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const role = useQuery({
    queryKey: ["my-membership", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("role")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.role as "owner" | "member" | undefined) ?? null;
    },
  });

  const value = useMemo<OrgContextValue>(() => {
    const loading = org.isLoading || role.isLoading || !userId;
    return {
      activeOrg: org.data ?? null,
      isLoading: loading,
      error: org.error,
      isMember: loading ? null : Boolean(role.data),
      isOwner: role.data === "owner",
      userEmail,
    };
  }, [org.data, org.isLoading, org.error, role.data, role.isLoading, userId, userEmail]);

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrgContext(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrgContext must be used inside OrgProvider");
  return ctx;
}
