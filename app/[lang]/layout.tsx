import { LangFromSegment } from "@/components/LangFromSegment";
import { isLocale } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/types";
import { notFound } from "next/navigation";

export default async function LangLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang } = await params;
  if (!isLocale(lang)) {
    notFound();
  }

  const locale = lang as Locale;

  return (
    <>
      <LangFromSegment locale={locale} />
      {children}
    </>
  );
}
