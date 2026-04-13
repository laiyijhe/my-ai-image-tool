"use client";

import { useAuthModal } from "@/components/auth/auth-modal-context";
import { Navbar } from "@/components/navigation/Navbar";
import { isLocale } from "@/lib/i18n/dictionary";
import { useLanguage } from "@/lib/i18n/language-context";
import { useSupabaseAuth } from "@/lib/supabase-auth-context";
import type { Locale } from "@/lib/i18n/types";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function LangHomePage() {
  const { t } = useLanguage();
  const { user, authAvailable } = useSupabaseAuth();
  const { openAuthModal } = useAuthModal();
  const params = useParams();
  const lang: Locale =
    typeof params?.lang === "string" && isLocale(params.lang)
      ? params.lang
      : "en";
  const lp = `/${lang}`;
  const portalHref = `${lp}/portal`;
  const verifyHref = `${lp}/verify`;

  return (
    <div className="relative flex flex-1 flex-col bg-canvas">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(0,175,240,0.12),transparent_55%)]" />

      <div className="relative mx-auto w-full max-w-3xl px-4 pb-24 pt-8 sm:px-6 sm:pt-14">
        <Navbar lang={lang} surface="light" />

        <header className="text-center">
          <h1 className="mx-auto max-w-[min(100%,19rem)] text-balance text-[1.68rem] font-semibold leading-[1.22] tracking-tight text-ink min-[400px]:max-w-[min(100%,22rem)] min-[400px]:text-[1.8rem] sm:max-w-[min(100%,36rem)] sm:text-4xl sm:leading-[1.15] md:max-w-none md:text-5xl md:leading-[1.12] lg:text-[3.25rem]">
            {t.homeHeroCanvaTitle}
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-balance px-1 text-[0.9375rem] text-ink-muted sm:px-0 sm:text-base sm:text-lg">
            {t.homeHeroCanvaSubtitle}
          </p>
          {user ? (
            <p className="mx-auto mt-4 max-w-md text-sm text-ink-muted">
              {t.homeWelcomeBack}
            </p>
          ) : null}

          <div className="mx-auto mt-12 max-w-md">
            {user ? (
              <Link
                href={verifyHref}
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-of-500 px-10 text-base font-semibold text-white shadow-[0_8px_32px_rgba(0,175,240,0.35)] transition hover:bg-of-600"
              >
                {t.homeCtaEnterDashboard}
              </Link>
            ) : authAvailable ? (
              <button
                type="button"
                onClick={() => openAuthModal()}
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-of-500 px-10 text-base font-semibold text-white shadow-[0_8px_32px_rgba(0,175,240,0.35)] transition hover:bg-of-600"
              >
                {t.homeCtaFreeStartProtect}
              </button>
            ) : (
              <Link
                href={portalHref}
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-of-500 px-10 text-base font-semibold text-white shadow-[0_8px_32px_rgba(0,175,240,0.35)] transition hover:bg-of-600"
              >
                {t.homeCtaFreeStartProtect}
              </Link>
            )}
          </div>

          <p className="mx-auto mt-10 max-w-md text-balance text-xs font-medium uppercase tracking-[0.16em] text-amber-700/90 sm:text-sm">
            {t.homeHeroFounderAuditLine}
          </p>
        </header>
      </div>
    </div>
  );
}
