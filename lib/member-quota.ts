import type { PlanType } from "@/lib/plan-types";
import { FREE_TIER_MEMBER_LIMIT } from "@/lib/plan-types";

/** Built-in swipe demo rows (`demo-1` …) do not count toward quota. */
export function isDemoSeedPortalMemberId(id: string): boolean {
  return /^demo-\d+$/i.test(id.trim());
}

export function countQuotaEligibleMembers(members: { id: string }[]): number {
  return members.filter((m) => !isDemoSeedPortalMemberId(m.id)).length;
}

export function isAtFreeMemberLimit(
  planType: PlanType,
  quotaMemberCount: number
): boolean {
  return planType === "free" && quotaMemberCount >= FREE_TIER_MEMBER_LIMIT;
}
