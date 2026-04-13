import type { PaidPlanType } from "@/lib/plan-types";

/** Normalized payload after provider-specific parsing (V6.9 skeleton). */
export type NormalizedPaymentEvent = {
  payment_status: string;
  user_id: string | null;
  plan_type: PaidPlanType | null;
};

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Stripe-style skeleton: expects JSON with optional nesting.
 * Real integration: verify `stripe-signature` with STRIPE_WEBHOOK_SECRET, then construct event from raw body.
 */
export function normalizeStripeLikePayload(body: unknown): NormalizedPaymentEvent {
  if (!body || typeof body !== "object") {
    return { payment_status: "", user_id: null, plan_type: null };
  }
  const o = body as Record<string, unknown>;
  const data = o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : {};
  const obj = data.object && typeof data.object === "object" ? (data.object as Record<string, unknown>) : o;

  const status =
    pickString(o, ["payment_status", "status"]) ??
    pickString(obj, ["payment_status", "status"]) ??
    "";

  const meta =
    obj.metadata && typeof obj.metadata === "object"
      ? (obj.metadata as Record<string, unknown>)
      : o.metadata && typeof o.metadata === "object"
        ? (o.metadata as Record<string, unknown>)
        : {};

  const userId =
    pickString(meta, ["supabase_user_id", "user_id", "client_reference_id"]) ??
    pickString(o, ["client_reference_id"]);

  const tierRaw =
    pickString(meta, ["plan_type", "tier", "product_tier"]) ??
    pickString(o, ["plan_type", "tier"]);

  let plan_type: PaidPlanType | null = null;
  if (tierRaw) {
    const t = tierRaw.toLowerCase();
    if (t === "pro") plan_type = "pro";
    else if (
      t === "pro_yearly" ||
      t === "pro-yearly" ||
      t === "founder" ||
      t === "founders"
    )
      plan_type = "pro_yearly";
    else if (t === "lifetime") plan_type = "lifetime";
  }

  return { payment_status: status.toLowerCase(), user_id: userId, plan_type };
}

/**
 * ECPay / generic gateway skeleton: flat JSON fields common in Taiwan gateways.
 */
export function normalizeEcpayLikePayload(body: unknown): NormalizedPaymentEvent {
  if (!body || typeof body !== "object") {
    return { payment_status: "", user_id: null, plan_type: null };
  }
  const o = body as Record<string, unknown>;
  const status =
    pickString(o, ["PaymentStatus", "payment_status", "RtnCode", "Status"]) ?? "";
  const userId = pickString(o, ["CustomField1", "user_id", "MerchantTradeNo"]) ?? null;
  const tierRaw = pickString(o, ["CustomField2", "plan_type", "ItemName"]) ?? null;

  let plan_type: PaidPlanType | null = null;
  if (tierRaw) {
    const t = tierRaw.toLowerCase();
    if (t.includes("lifetime")) plan_type = "lifetime";
    else if (t.includes("year") || t.includes("founder") || t === "pro_yearly")
      plan_type = "pro_yearly";
    else if (t.includes("pro")) plan_type = "pro";
  }

  const ok =
    status === "success" ||
    status === "1" ||
    status.toLowerCase() === "paid" ||
    status.toLowerCase() === "succeeded";

  return {
    payment_status: ok ? "success" : status.toLowerCase(),
    user_id: userId,
    plan_type,
  };
}

export function pickPaymentEvent(
  stripe: NormalizedPaymentEvent,
  ecpay: NormalizedPaymentEvent,
  providerHint: string | null
): NormalizedPaymentEvent {
  if (providerHint === "ecpay") return ecpay;
  if (providerHint === "stripe") return stripe;
  if (stripe.user_id || stripe.plan_type) return stripe;
  return ecpay;
}

export function isPaymentSuccessStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "success" || s === "paid" || s === "succeeded" || s === "complete";
}
