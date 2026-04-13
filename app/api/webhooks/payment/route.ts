import {
  isPaymentSuccessStatus,
  normalizeEcpayLikePayload,
  normalizeStripeLikePayload,
  pickPaymentEvent,
} from "@/lib/payment-webhook";
import { isPurchasablePlanType } from "@/lib/plan-types";
import { getStripe } from "@/lib/stripe";
import { handleStripeCheckoutSessionCompleted } from "@/lib/stripe-checkout-webhook";
import { createServiceSupabaseClient } from "@/lib/supabase-service";
import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

export const runtime = "nodejs";

async function handleLegacyJsonWebhook(
  body: unknown,
  providerHint: string | null
): Promise<NextResponse> {
  const stripeNorm = normalizeStripeLikePayload(body);
  const ecpayNorm = normalizeEcpayLikePayload(body);
  const ev = pickPaymentEvent(stripeNorm, ecpayNorm, providerHint);

  if (!isPaymentSuccessStatus(ev.payment_status)) {
    return NextResponse.json({
      ok: true,
      handled: false,
      reason: "not_success",
      payment_status: ev.payment_status,
    });
  }

  const userId = ev.user_id;
  const tier = ev.plan_type;

  if (!userId) {
    return NextResponse.json(
      {
        error: "missing_user",
        message:
          "Successful payment but no user id (metadata.supabase_user_id / client_reference_id / CustomField1).",
      },
      { status: 400 }
    );
  }

  if (!isPurchasablePlanType(tier)) {
    return NextResponse.json(
      {
        error: "missing_or_invalid_plan",
        message:
          "Successful payment but plan_type must be `pro`, `pro_yearly`, or `lifetime`.",
      },
      { status: 400 }
    );
  }

  const admin = createServiceSupabaseClient();
  if (!admin) {
    console.warn(
      "[webhooks/payment] SUPABASE_SERVICE_ROLE_KEY missing — cannot update profiles.plan_type"
    );
    return NextResponse.json(
      {
        ok: false,
        warning: "no_service_role",
        message:
          "Configure SUPABASE_SERVICE_ROLE_KEY to persist plan upgrades from webhooks.",
      },
      { status: 503 }
    );
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      plan_type: tier,
      updated_at: now,
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("[webhooks/payment] profiles upsert failed:", error);
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    handled: true,
    user_id: userId,
    plan_type: tier,
  });
}

/**
 * Stripe sends raw body + `Stripe-Signature`. ECPay / manual tests may POST JSON without signature.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const sig = request.headers.get("stripe-signature");
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (sig && whSecret) {
    let event: Stripe.Event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(raw, sig, whSecret);
    } catch (err) {
      console.error("[webhooks/payment] Stripe signature verification failed:", err);
      return NextResponse.json(
        { error: "invalid_signature", message: "Stripe webhook signature invalid." },
        { status: 400 }
      );
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await handleStripeCheckoutSessionCompleted(session);
      if (!result.ok) {
        console.error("[webhooks/payment] checkout.session.completed:", result.message);
        return NextResponse.json(
          { error: "handler_failed", message: result.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ received: true, handled: true });
    }

    return NextResponse.json({ received: true, handled: false, type: event.type });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "Expected Stripe signature or JSON body." },
      { status: 400 }
    );
  }

  const providerHint =
    request.headers.get("x-cg-payment-provider")?.trim().toLowerCase() ?? null;
  return handleLegacyJsonWebhook(body, providerHint);
}
