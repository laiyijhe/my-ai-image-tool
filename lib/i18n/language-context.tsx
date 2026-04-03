"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { dictionary, isLocale } from "./dictionary";
import type { Locale, Messages } from "./types";

/** Primary key for locale persistence (cross-page). */
const CG_LOCALE_KEY = "cg_locale";
/** Legacy key — read once and migrated into `cg_locale`. */
const LEGACY_LOCALE_KEY = "creatorGuardLocale";

const htmlLangMap: Record<Locale, string> = {
  en: "en",
  "zh-TW": "zh-Hant",
  "zh-CN": "zh-Hans",
  ja: "ja",
  ko: "ko",
};

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Messages;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    startTransition(() => {
      try {
        let saved = localStorage.getItem(CG_LOCALE_KEY);
        if (!saved || !isLocale(saved)) {
          const legacy = localStorage.getItem(LEGACY_LOCALE_KEY);
          if (legacy && isLocale(legacy)) {
            saved = legacy;
            localStorage.setItem(CG_LOCALE_KEY, legacy);
          }
        }
        if (saved && isLocale(saved)) setLocaleState(saved);
      } catch {
        /* ignore */
      }
    });
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(CG_LOCALE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = htmlLangMap[locale];
    }
  }, [locale]);

  const t = useMemo(() => dictionary[locale], [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
