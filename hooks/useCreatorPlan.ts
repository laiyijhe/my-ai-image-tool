"use client";

import { fetchProfilePlan, ensureProfileAndUsageRows } from "@/lib/supabase-profile";
import type { PlanType } from "@/lib/plan-types";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { useSupabaseAuth } from "@/lib/supabase-auth-context";
import { useEffect, useState } from "react";

export function useCreatorPlan(): { planType: PlanType; loading: boolean } {
  const { user, authAvailable } = useSupabaseAuth();
  const [planType, setPlanType] = useState<PlanType>("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!authAvailable || !user?.id) {
        setPlanType("free");
        setLoading(false);
        return;
      }
      const client = getSupabaseBrowserClient();
      if (!client) {
        setPlanType("free");
        setLoading(false);
        return;
      }

      setLoading(true);
      await ensureProfileAndUsageRows(client, user.id);
      const plan = await fetchProfilePlan(client, user.id);
      if (!cancelled) {
        setPlanType(plan);
        setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, authAvailable]);

  return { planType, loading };
}
