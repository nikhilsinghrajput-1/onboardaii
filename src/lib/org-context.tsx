import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { orgsQuery, readActiveOrgId, writeActiveOrgId, type Organization } from "@/lib/orgs";

type OrgContextValue = {
  orgs: Organization[];
  activeOrg: Organization | null;
  isLoading: boolean;
  error: unknown;
  setActiveOrg: (id: string) => void;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const orgs = useQuery(orgsQuery);
  const [activeId, setActiveId] = useState<string | null>(() => readActiveOrgId());

  const list = orgs.data ?? [];
  const activeOrg = list.find((o) => o.id === activeId) ?? null;

  // Fall back to the only / first membership when nothing valid is stored.
  useEffect(() => {
    if (orgs.isLoading || list.length === 0) return;
    if (!activeOrg) {
      const next = list[0]!;
      setActiveId(next.id);
      writeActiveOrgId(next.id);
    }
  }, [orgs.isLoading, list, activeOrg]);

  const value = useMemo<OrgContextValue>(
    () => ({
      orgs: list,
      activeOrg,
      isLoading: orgs.isLoading,
      error: orgs.error,
      setActiveOrg: (id: string) => {
        setActiveId(id);
        writeActiveOrgId(id);
      },
    }),
    [list, activeOrg, orgs.isLoading, orgs.error],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrgContext(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrgContext must be used inside OrgProvider");
  return ctx;
}
