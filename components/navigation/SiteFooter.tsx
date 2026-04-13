"use client";

import { useLanguage } from "@/lib/i18n/language-context";
import type { Locale } from "@/lib/i18n/types";
import Link from "next/link";

type SiteFooterProps = {
  lang: Locale;
};

export function SiteFooter({ lang }: SiteFooterProps) {
  const { t } = useLanguage();
  const base = `/${lang}`;

  return (
    <footer
      className="mt-auto border-t border-slate-200/90 bg-canvas-subtle py-6 text-center"
      role="contentinfo"
    >
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 sm:gap-x-6">
        <Link
          href={`${base}/pricing`}
          className="text-sm font-semibold text-of-600 underline-offset-4 transition hover:text-of-500 hover:underline"
        >
          {t.footerPricing}
        </Link>
        <span className="hidden text-slate-400 sm:inline" aria-hidden>
          ·
        </span>
        <Link
          href={`${base}/terms`}
          className="text-sm font-medium text-ink-muted underline-offset-4 transition hover:text-of-600 hover:underline"
        >
          {t.footerTerms}
        </Link>
        <span className="hidden text-slate-400 sm:inline" aria-hidden>
          ·
        </span>
        <Link
          href={`${base}/privacy`}
          className="text-sm font-medium text-ink-muted underline-offset-4 transition hover:text-of-600 hover:underline"
        >
          {t.footerPrivacy}
        </Link>
      </div>
      <p className="mt-3 text-xs text-slate-400">Creator Guard</p>
    </footer>
  );
}
