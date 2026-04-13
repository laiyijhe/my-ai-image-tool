import { createCheckoutSession, isStripeConfigured } from "@/lib/stripe";
import { isConfiguredStripePrice } from "@/lib/stripe-prices";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase-server";
import { isLocale } from "@/lib/i18n/dictionary";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function requestOrigin(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host.split(",")[0]!.trim()}`;
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: "stripe_unconfigured",
        message: "Set STRIPE_SECRET_KEY and Stripe Price IDs to enable checkout.",
      },
      { status: 503 }
    );
  }

  let body: { priceId?: string; lang?: string };
  try {
    body = (await request.json()) as { priceId?: string; lang?: string };
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Expected JSON body." },
      { status: 400 }
    );
  }

  const priceId = String(body.priceId ?? "").trim();
  const langRaw = String(body.lang ?? "en").trim();
  const lang = isLocale(langRaw) ? langRaw : "en";

  if (!priceId) {
    return NextResponse.json(
      { error: "missing_price_id", message: "Field `priceId` is required." },
      { status: 400 }
    );
  }

  if (!isConfiguredStripePrice(priceId)) {
    return NextResponse.json(
      { error: "unknown_price_id", message: "This price is not enabled on the server." },
      { status: 400 }
    );
  }

  let supabase;
  try {
    supabase = await createSupabaseRouteHandlerClient();
  } catch {
    return NextResponse.json(
      { error: "supabase_unconfigured", message: "Supabase env is missing." },
      { status: 503 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Sign in to purchase. Open the pricing page while logged in.",
      },
      { status: 401 }
    );
  }

  const origin = requestOrigin(request);
  const successUrl = `${origin}/${lang}/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/${lang}/pricing`;

  try {
    const session = await createCheckoutSession({
      priceId,
      userId: user.id,
      lang,
      successUrl,
      cancelUrl,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "no_checkout_url", message: "Stripe did not return a session URL." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "checkout_failed";
    console.error("[api/checkout]", e);
    return NextResponse.json(
      { error: "checkout_failed", message: msg },
      { status: 500 }
    );
  }
}
