"use client";

import { Navbar } from "@/components/navigation/Navbar";
import { useLanguage } from "@/lib/i18n/language-context";
import Link from "next/link";
import { useEffect, useRef } from "react";

export default function SuccessCelebrationPage() {
  const { t, locale } = useLanguage();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    let cancelled = false;
    const run = async () => {
      const confetti = (await import("canvas-confetti")).default;
      if (cancelled) return;

      const burst = () => {
        void confetti({
          particleCount: 100,
          spread: 72,
          origin: { y: 0.55 },
          scalar: 1.05,
          ticks: 200,
          colors: ["#2dd4bf", "#34d399", "#fbbf24", "#a78bfa", "#f472b6"],
        });
      };

      burst();
      setTimeout(() => {
        if (!cancelled) burst();
      }, 320);
      setTimeout(() => {
        if (!cancelled) {
          void confetti({
            particleCount: 60,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.65 },
            colors: ["#2dd4bf", "#fbbf24"],
          });
          void confetti({
            particleCount: 60,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.65 },
            colors: ["#34d399", "#a78bfa"],
          });
        }
      }, 600);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const portalHref =
    locale === "zh-TW" ? "/zh-TW/portal" : `/${locale}/portal`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.2]"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 0%, rgba(45,212,191,0.35), transparent 55%)",
        }}
      />
      <div className="relative mx-auto max-w-lg px-4 pb-24 pt-6 sm:px-6">
        <Navbar lang={locale} surface="light" />
        <main className="mt-16 text-center">
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-teal-400/40 bg-teal-500/10 text-4xl shadow-[0_0_40px_rgba(45,212,191,0.25)]"
            aria-hidden
            title="Confetti / 紙花"
          >
            🎉
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {t.successPageTitle}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            {t.successPageSubtitle}
          </p>
          <Link
            href={portalHref}
            className="mt-10 inline-flex w-full max-w-sm items-center justify-center rounded-2xl border border-teal-400/50 bg-gradient-to-r from-teal-500/25 to-emerald-500/20 px-6 py-4 text-base font-semibold text-teal-50 shadow-[0_0_32px_rgba(45,212,191,0.2)] transition hover:border-teal-400/70 hover:from-teal-500/35 hover:to-emerald-500/28"
          >
            {t.successEnterDashboardCta}
          </Link>
          <Link
            href={`/${locale}/pricing`}
            className="mt-6 inline-block text-sm text-slate-500 underline-offset-4 hover:text-slate-300 hover:underline"
          >
            {t.successViewPricingAgain}
          </Link>
        </main>
      </div>
    </div>
  );
}
