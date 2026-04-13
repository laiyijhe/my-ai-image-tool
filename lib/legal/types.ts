import type { Locale } from "@/lib/i18n/types";

export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

export function pickLegalLocale(locale: Locale): "zh-TW" | "zh-CN" | "en" {
  if (locale === "zh-TW") return "zh-TW";
  if (locale === "zh-CN") return "zh-CN";
  return "en";
}
