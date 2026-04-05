"use client";

import { useLanguage } from "@/lib/i18n/language-context";
import type { Locale } from "@/lib/i18n/types";
import { useEffect } from "react";

/** Syncs UI locale with the `[lang]` URL segment (overrides stale localStorage for this subtree). */
export function LangFromSegment({ locale }: { locale: Locale }) {
  const { setLocale } = useLanguage();

  useEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);

  return null;
}
