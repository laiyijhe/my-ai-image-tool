"use client";

import { Navbar } from "@/components/navigation/Navbar";
import type { Locale, Messages } from "@/lib/i18n/types";
import Link from "next/link";
import { useCallback, useState } from "react";

const FOUNDERS_SLOTS_REMAINING = 100;

type PricingPageProps = {
  locale: Locale;
  t: Messages;
  priceIdMonthly: string;
  priceIdLifetime: string;
  /** Fallback when `priceIdMonthly` is empty (e.g. `NEXT_PUBLIC_CHECKOUT_PRO_URL`). */
  checkoutUrlMonthly?: string;
  /** Fallback for the second card when `priceIdLifetime` is empty (e.g. yearly payment link). */
  checkoutUrlYearly?: string;
};

export function PricingPage({
  locale,
  t,
  priceIdMonthly,
  priceIdLifetime,
  checkoutUrlMonthly = "",
  checkoutUrlYearly = "",
}: PricingPageProps) {
  const portalHref =
    locale === "zh-TW" ? "/zh-TW/portal" : `/${locale}/portal`;

  const [busy, setBusy] = useState<"monthly" | "lifetime" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const monthlyReady = Boolean(priceIdMonthly || checkoutUrlMonthly);
  const secondCardReady = Boolean(priceIdLifetime || checkoutUrlYearly);

  const startCheckout = useCallback(
    async (which: "monthly" | "lifetime") => {
      const priceId = which === "monthly" ? priceIdMonthly : priceIdLifetime;
      const directUrl =
        which === "monthly" ? checkoutUrlMonthly : checkoutUrlYearly;
      if (!priceId && !directUrl) {
        setErr(t.pricingCheckoutConfigureHint);
        return;
      }
      setBusy(which);
      setErr(null);
      try {
        if (!priceId) {
          window.location.href = directUrl;
          return;
        }
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ priceId, lang: locale }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          url?: string;
          message?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(
            data.message ?? data.error ?? `Checkout failed (${res.status})`
          );
        }
        if (data.url) {
          window.location.href = data.url;
          return;
        }
        throw new Error("No checkout URL returned.");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Checkout failed.");
      } finally {
        setBusy(null);
      }
    },
    [
      checkoutUrlMonthly,
      checkoutUrlYearly,
      locale,
      priceIdLifetime,
      priceIdMonthly,
      t.pricingCheckoutConfigureHint,
    ]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-6 sm:px-6">
        <Navbar lang={locale} surface="light" />

        <header className="mt-10 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {t.pricingPageTitle}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-400">
            {t.pricingPageSubtitle}
          </p>
        </header>

        {err ? (
          <p
            className="mx-auto mt-6 max-w-xl rounded-xl border border-rose-500/40 bg-rose-950/50 px-4 py-3 text-center text-sm text-rose-100"
            role="alert"
          >
            {err}
          </p>
        ) : null}

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          {/* Pro monthly */}
          <article className="relative flex flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-950 p-8 shadow-xl">
            <h2 className="text-xl font-semibold text-white">
              {t.pricingCardProTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {t.pricingCardProDescription}
            </p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-teal-200">
                {t.pricingCardProPrice}
              </span>
              <span className="text-sm text-slate-500">
                {t.pricingCardProPeriod}
              </span>
            </div>
            <StripeCheckoutButton
              label={t.pricingBuyNowPro}
              disabledHint={t.pricingCheckoutConfigureHint}
              loading={busy === "monthly"}
              enabled={monthlyReady}
              onClick={() => void startCheckout("monthly")}
            />
          </article>

          {/* Founders · lifetime */}
          <article className="relative flex flex-col rounded-2xl border border-amber-400/35 bg-gradient-to-b from-amber-950/40 via-slate-900/90 to-slate-950 p-8 shadow-[0_0_60px_rgba(251,191,36,0.08)]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <span className="inline-flex items-center rounded-lg border-2 border-rose-400/85 bg-gradient-to-r from-rose-500/25 to-orange-500/20 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-rose-50 shadow-[0_0_22px_rgba(251,113,133,0.45)] ring-1 ring-rose-300/50">
                {t.pricingFounderSlotsOnlyBadge}
              </span>
              <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-100">
                {t.pricingFounderBadge}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-white">
              {t.pricingCardFounderTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {t.pricingCardFounderDescription}
            </p>
            <p className="mt-4 text-sm font-medium text-amber-200/95">
              {t.pricingFoundersSlotsLine.replace(
                "{count}",
                String(FOUNDERS_SLOTS_REMAINING)
              )}
            </p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-amber-100">
                {t.pricingCardFounderPrice}
              </span>
              <span className="text-sm text-slate-500">
                {t.pricingCardFounderPeriod}
              </span>
            </div>
            <StripeCheckoutButton
              label={t.pricingBuyNowFounder}
              disabledHint={t.pricingCheckoutConfigureHint}
              loading={busy === "lifetime"}
              enabled={secondCardReady}
              onClick={() => void startCheckout("lifetime")}
              variant="founder"
            />
          </article>
        </div>

        <p className="mt-10 text-center text-xs text-slate-600">
          {t.pricingCheckoutFootnote}
        </p>

        <div className="mt-8 flex justify-center">
          <Link
            href={`/${locale}`}
            className="text-sm font-medium text-slate-500 underline-offset-4 hover:text-slate-300 hover:underline"
          >
            {t.portalBackHome}
          </Link>
          <span className="mx-3 text-slate-700" aria-hidden>
            ·
          </span>
          <Link
            href={portalHref}
            className="text-sm font-medium text-teal-400/90 underline-offset-4 hover:text-teal-300 hover:underline"
          >
            {t.pricingSkipToPortal}
          </Link>
        </div>
      </div>
    </div>
  );
}

function StripeCheckoutButton({
  label,
  disabledHint,
  enabled,
  loading,
  onClick,
  variant = "default",
}: {
  label: string;
  disabledHint: string;
  enabled: boolean;
  loading: boolean;
  onClick: () => void;
  variant?: "default" | "founder";
}) {
  const className =
    variant === "founder"
      ? "mt-8 inline-flex w-full items-center justify-center rounded-xl border border-amber-400/50 bg-amber-500/20 px-4 py-3 text-sm font-semibold text-amber-50 shadow-[0_0_24px_rgba(251,191,36,0.15)] transition hover:border-amber-400/70 hover:bg-amber-500/30 disabled:pointer-events-none disabled:opacity-45"
      : "mt-8 inline-flex w-full items-center justify-center rounded-xl border border-teal-400/45 bg-teal-500/15 px-4 py-3 text-sm font-semibold text-teal-50 shadow-[0_0_24px_rgba(45,212,191,0.15)] transition hover:border-teal-400/65 hover:bg-teal-500/25 disabled:pointer-events-none disabled:opacity-45";

  return (
    <button
      type="button"
      className={className}
      disabled={!enabled || loading}
      title={!enabled ? disabledHint : undefined}
      onClick={onClick}
    >
      {loading ? "…" : label}
    </button>
  );
}
