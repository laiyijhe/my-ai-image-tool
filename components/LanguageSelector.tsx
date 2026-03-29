"use client";

import { localeLabels, locales } from "@/lib/i18n/dictionary";
import { useLanguage } from "@/lib/i18n/language-context";
import type { Locale } from "@/lib/i18n/types";

export function LanguageSelector() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="site-language" className="sr-only">
        {t.languageLabel}
      </label>
      <select
        id="site-language"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="cursor-pointer rounded-lg border border-slate-600/90 bg-slate-900/90 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {localeLabels[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
