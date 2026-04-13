import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { resolveCheckoutPlan } from "@/lib/stripe-prices";
import { isPurchasablePlanType, type PaidPlanType } from "@/lib/plan-types";
import { createServiceSupabaseClient } from "@/lib/supabase-service";

function planTypeFromSession(session: Stripe.Checkout.Session): PaidPlanType | null {
  const meta = session.metadata?.cg_plan_type?.trim().toLowerCase();
  if (meta && isPurchasablePlanType(meta)) return meta;

  const lineItems = session.line_items;
  const first = lineItems?.data?.[0];
  const priceObj = first?.price;
  const priceId =
    typeof priceObj === "string"
      ? priceObj
      : priceObj && typeof priceObj === "object" && "id" in priceObj
        ? String((priceObj as { id: string }).id)
        : null;
  if (!priceId) return null;
  return resolveCheckoutPlan(priceId)?.plan_type ?? null;
}

/**
 * After `checkout.session.completed`: set `profiles.plan_type` and `subscription_end`.
 * - Subscriptions: `subscription_end` = current period end (renewal updates can be added later).
 * - Lifetime (one-time): `subscription_end` = null.
 */
export async function handleStripeCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<{ ok: true } | { ok: false; message: string }> {
  const userId =
    session.client_reference_id?.trim() ||
    session.metadata?.supabase_user_id?.trim() ||
    null;

  if (!userId) {
    return { ok: false, message: "missing client_reference_id / metadata.supabase_user_id" };
  }

  let plan_type = planTypeFromSession(session);
  if (!plan_type) {
    const stripe = getStripe();
    const full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items.data.price"],
    });
    plan_type = planTypeFromSession(full);
  }

  if (!isPurchasablePlanType(plan_type)) {
    return { ok: false, message: "could not resolve cg_plan_type / price id" };
  }

  let subscription_end: string | null = null;
  if (session.mode === "subscription") {
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription && typeof session.subscription === "object"
          ? (session.subscription as { id: string }).id
          : null;
    if (subId) {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subId);
      const periodEndSec = sub.items?.data?.[0]?.current_period_end;
      if (typeof periodEndSec === "number" && Number.isFinite(periodEndSec)) {
        subscription_end = new Date(periodEndSec * 1000).toISOString();
      }
    }
  } else {
    subscription_end = null;
  }

  const admin = createServiceSupabaseClient();
  if (!admin) {
    return { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY missing" };
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      plan_type,
      subscription_end,
      updated_at: now,
    },
    { onConflict: "id" }
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}
