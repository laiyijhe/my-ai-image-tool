"use client";

import { LanguageSelector } from "@/components/LanguageSelector";
import { isLocale } from "@/lib/i18n/dictionary";
import { useLanguage } from "@/lib/i18n/language-context";
import type { Locale } from "@/lib/i18n/types";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function LangHomePage() {
  const { t } = useLanguage();
  const params = useParams();
  const lang: Locale =
    typeof params?.lang === "string" && isLocale(params.lang)
      ? params.lang
      : "en";
  const lp = `/${lang}`;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.12),transparent)]" />

      <div className="relative mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        <div className="mb-8 flex justify-end">
          <LanguageSelector />
        </div>

        <header className="mb-12 text-center sm:mb-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-400/85">
            {t.heroSubtitle}
          </p>
          <h1 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-white sm:text-4xl">
            {t.heroTitle}
          </h1>
          <p className="mx-auto mt-4 inline-flex max-w-md items-center justify-center rounded-full border border-cyan-500/25 bg-cyan-500/[0.07] px-3 py-1 text-[11px] font-medium tracking-wide text-cyan-300/90">
            {t.highResistProtectionBadge}
          </p>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-500">
            {t.heroTagline}
          </p>

          <div className="mx-auto mt-12 flex w-full max-w-xl flex-col gap-4 sm:mt-14 sm:flex-row sm:items-stretch sm:justify-center sm:gap-5">
            <Link
              href={`${lp}/protect/pdf`}
              className="flex min-h-[4.5rem] flex-1 items-center justify-center rounded-2xl bg-gradient-to-b from-cyan-200 via-cyan-400 to-teal-500 px-6 py-4 text-center text-lg font-extrabold tracking-tight text-slate-950 shadow-[0_0_40px_rgba(34,211,238,0.45)] ring-2 ring-cyan-100/70 transition hover:brightness-110 active:scale-[0.99] sm:text-xl"
            >
              {t.homeCtaStartProtecting}
            </Link>
            <Link
              href={`${lp}/verify`}
              className="flex min-h-[4.5rem] flex-1 items-center justify-center rounded-2xl border-2 border-cyan-500/45 bg-slate-900/85 px-6 py-4 text-center text-lg font-bold tracking-tight text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.18)] transition hover:border-cyan-400/65 hover:bg-slate-800/90 active:scale-[0.99] sm:text-xl"
            >
              {t.homeCtaVerifyEvidence}
            </Link>
          </div>

          <p className="mt-10 text-center">
            <Link
              href={`${lp}/portal`}
              className="text-sm text-slate-500 underline-offset-4 transition hover:text-slate-300 hover:underline"
            >
              {t.homeLinkAdvancedPortal}
            </Link>
          </p>
        </header>
      </div>
    </div>
  );
}
