import type { PaidPlanType } from "@/lib/plan-types";

export type CheckoutPlanResolution = {
  plan_type: PaidPlanType;
  mode: "subscription" | "payment";
};

function envPrice(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

/** Server-side Stripe Price IDs (authoritative for /api/checkout validation). */
export function resolveCheckoutPlan(priceId: string): CheckoutPlanResolution | null {
  const monthly = envPrice("STRIPE_PRICE_PRO_MONTHLY");
  const yearly = envPrice("STRIPE_PRICE_PRO_YEARLY");
  const lifetime = envPrice("STRIPE_PRICE_LIFETIME");

  if (monthly && priceId === monthly) {
    return { plan_type: "pro", mode: "subscription" };
  }
  if (yearly && priceId === yearly) {
    return { plan_type: "pro_yearly", mode: "subscription" };
  }
  if (lifetime && priceId === lifetime) {
    return { plan_type: "lifetime", mode: "payment" };
  }
  return null;
}

export function isConfiguredStripePrice(priceId: string): boolean {
  return resolveCheckoutPlan(priceId) != null;
}
