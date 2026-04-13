"use client";

import { PricingPage } from "@/components/pricing/PricingPage";
import { useLanguage } from "@/lib/i18n/language-context";

export default function PricingRoutePage() {
  const { t, locale } = useLanguage();

  const priceIdMonthly =
    process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY?.trim() ?? "";
  const priceIdLifetime =
    process.env.NEXT_PUBLIC_STRIPE_PRICE_LIFETIME?.trim() ?? "";
  /** Optional direct links (e.g. Stripe Payment Links) when Price IDs are not set. */
  const checkoutUrlMonthly =
    process.env.NEXT_PUBLIC_CHECKOUT_PRO_URL?.trim() ?? "";
  const checkoutUrlYearly =
    process.env.NEXT_PUBLIC_CHECKOUT_PRO_YEARLY_URL?.trim() ?? "";

  return (
    <PricingPage
      locale={locale}
      t={t}
      priceIdMonthly={priceIdMonthly}
      priceIdLifetime={priceIdLifetime}
      checkoutUrlMonthly={checkoutUrlMonthly}
      checkoutUrlYearly={checkoutUrlYearly}
    />
  );
}
