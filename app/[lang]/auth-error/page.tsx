"use client";

import { Navbar } from "@/components/navigation/Navbar";
import { useLanguage } from "@/lib/i18n/language-context";
import Link from "next/link";

export default function AuthErrorPage() {
  const { t, locale } = useLanguage();

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <div className="mx-auto w-full max-w-lg px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <Navbar lang={locale} surface="light" />
        <main className="mt-10 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            {t.authErrorCallbackTitle}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            {t.authErrorCallbackBody}
          </p>
          <Link
            href={`/${locale}`}
            className="mt-10 inline-flex min-h-[48px] items-center justify-center rounded-full bg-of-500 px-8 text-sm font-semibold text-white shadow-sm transition hover:bg-of-600"
          >
            {t.authErrorCallbackCtaHome}
          </Link>
        </main>
      </div>
    </div>
  );
}
