import type { Metadata } from "next";
import { LanguageProvider } from "@/lib/i18n/language-context";
import { LiffProvider } from "@/lib/line/liff-provider";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Creator Guard - Digital Rights Protection",
  description:
    "Protect and track your digital content with per-member encrypted delivery links built for creators.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased">
        <LanguageProvider>
          <LiffProvider>{children}</LiffProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
