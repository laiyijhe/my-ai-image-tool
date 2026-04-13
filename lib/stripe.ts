import Stripe from "stripe";
import { resolveCheckoutPlan } from "@/lib/stripe-prices";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set.");
    }
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/**
 * Creates a Stripe Checkout Session with `client_reference_id` = Supabase user id
 * and metadata for webhook plan mapping.
 */
export async function createCheckoutSession(params: {
  priceId: string;
  userId: string;
  lang: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const plan = resolveCheckoutPlan(params.priceId);
  if (!plan) {
    throw new Error("invalid_price_id");
  }

  const stripe = getStripe();
  const meta = {
    supabase_user_id: params.userId,
    cg_plan_type: plan.plan_type,
  };

  return stripe.checkout.sessions.create({
    mode: plan.mode,
    client_reference_id: params.userId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    locale: params.lang === "zh-TW" ? "zh" : params.lang === "ja" ? "ja" : params.lang === "ko" ? "ko" : "auto",
    metadata: meta,
    subscription_data:
      plan.mode === "subscription"
        ? { metadata: { ...meta } }
        : undefined,
    payment_intent_data:
      plan.mode === "payment" ? { metadata: { ...meta } } : undefined,
  });
}
