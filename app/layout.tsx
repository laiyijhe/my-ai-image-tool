import type { Metadata } from "next";
import { AuthModalProvider } from "@/components/auth/auth-modal-context";
import { LanguageProvider } from "@/lib/i18n/language-context";
import { LiffProvider } from "@/lib/line/liff-provider";
import { SupabaseAuthProvider } from "@/lib/supabase-auth-context";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Creator Guard - Digital Rights Protection",
  description:
    "Protect and track your digital content with per-member encrypted delivery links built for creators.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={plusJakarta.variable}>
      {/* V7.3: default shell is light (canvas + ink). Gated areas (portal, etc.) set their own bg-canvas wrappers. */}
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <LanguageProvider>
          <SupabaseAuthProvider>
            <AuthModalProvider>
              <LiffProvider>{children}</LiffProvider>
            </AuthModalProvider>
          </SupabaseAuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
