import { parsePlanTypeFromDb, type PlanType } from "@/lib/plan-types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * When true, the browser skips all `profiles` / `usage_stats` REST calls (select + insert).
 * Stops 403 churn from RLS during local dev (e.g. File System API + `showDirectoryPicker`).
 * Set to false when Supabase RLS/policies are configured and you need real plan rows.
 */
const DISABLE_PROFILE_USAGE_CLIENT = true;

export async function fetchProfilePlan(
  client: SupabaseClient,
  userId: string
): Promise<PlanType> {
  if (DISABLE_PROFILE_USAGE_CLIENT) {
    void client;
    void userId;
    return "free";
  }

  const { data, error } = await client
    .from("profiles")
    .select("plan_type")
    .eq("id", userId)
    .maybeSingle();

  if (error || data?.plan_type == null) return "free";
  return parsePlanTypeFromDb(String(data.plan_type));
}

/** Create `profiles` + `usage_stats` rows on first visit (RLS: own user only). */
export async function ensureProfileAndUsageRows(
  client: SupabaseClient,
  userId: string
): Promise<void> {
  if (DISABLE_PROFILE_USAGE_CLIENT) return;

  const { data: existing } = await client
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!existing) {
    await client.from("profiles").insert({
      id: userId,
      plan_type: "free",
    });
  }

  const { data: usage } = await client
    .from("usage_stats")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!usage) {
    await client.from("usage_stats").insert({
      user_id: userId,
      members_created: 0,
    });
  }
}
