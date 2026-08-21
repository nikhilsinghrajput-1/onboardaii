import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

/** Keeps hires, tasks, and approvals live without a page refresh. */
export function useRealtimeRefresh() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("onboarding-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "hires" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["hires"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding_tasks" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["approvals"] });
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
