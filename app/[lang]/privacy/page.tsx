"use client";

import { LegalDocumentBody } from "@/components/legal/LegalDocumentBody";
import { Navbar } from "@/components/navigation/Navbar";
import { getPrivacySections } from "@/lib/legal/privacy-bodies";
import { useLanguage } from "@/lib/i18n/language-context";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  const { t, locale } = useLanguage();
  const sections = getPrivacySections(locale);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6">
        <Navbar lang={locale} surface="light" />
        <article className="mt-10">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            {t.legalPrivacyTitle}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">{t.legalEffectiveDate}</p>
          <div className="mt-10">
            <LegalDocumentBody sections={sections} />
          </div>
          <p className="mt-14">
            <Link
              href={`/${locale}`}
              className="text-sm font-medium text-of-600 underline-offset-4 hover:text-of-700 hover:underline"
            >
              {t.legalBackHome}
            </Link>
          </p>
        </article>
      </div>
    </div>
  );
}
