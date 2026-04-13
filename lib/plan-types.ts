export type PlanType = "free" | "pro" | "pro_yearly" | "lifetime";

export const FREE_TIER_MEMBER_LIMIT = 5;

export type PaidPlanType = Exclude<PlanType, "free">;

export function isPaidPlan(plan: PlanType): boolean {
  return plan === "pro" || plan === "pro_yearly" || plan === "lifetime";
}

export function isPurchasablePlanType(
  p: string | null | undefined
): p is PaidPlanType {
  return p === "pro" || p === "pro_yearly" || p === "lifetime";
}

/** For API form fields: omit free-tier PDF branding unless `free` is explicit. */
export function parseOptionalPlanType(raw: unknown): PlanType | undefined {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "free") return "free";
  if (s === "pro") return "pro";
  if (s === "pro_yearly" || s === "pro-yearly") return "pro_yearly";
  if (s === "lifetime") return "lifetime";
  return undefined;
}

/** Map DB / webhook string to {@link PlanType}. */
export function parsePlanTypeFromDb(raw: string | null | undefined): PlanType {
  if (!raw) return "free";
  const s = raw.trim().toLowerCase();
  if (s === "lifetime") return "lifetime";
  if (s === "pro_yearly" || s === "pro-yearly") return "pro_yearly";
  if (s === "pro") return "pro";
  return "free";
}
