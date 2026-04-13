"use client";

import { LanguageSelector } from "@/components/LanguageSelector";
import { UserActionsToolbar } from "@/components/navigation/UserActionsToolbar";
import { useLanguage } from "@/lib/i18n/language-context";
import type { Locale } from "@/lib/i18n/types";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

type NavbarProps = {
  lang: Locale;
  /** V7.3: pass `"light"` on every route (Home, Portal, Pricing, …). */
  surface?: "light" | "dark";
};

export function Navbar({ lang, surface = "light" }: NavbarProps) {
  const { t } = useLanguage();
  const lp = `/${lang}`;
  const light = surface === "light";

  return (
    <nav
      className="mb-8 flex flex-wrap items-center justify-between gap-3"
      aria-label="Main"
    >
      <Link
        href={lp}
        className={
          light
            ? "flex items-center gap-2.5 rounded-xl outline-none ring-offset-2 ring-offset-white transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-of-500/40"
            : "flex items-center gap-2.5 rounded-xl outline-none ring-offset-2 ring-offset-slate-950 transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-cyan-500/50"
        }
      >
        <motion.span
          className="relative inline-flex shrink-0 rounded-xl"
          animate={{
            boxShadow: light
              ? [
                  "0 0 0 0 rgba(0,175,240,0)",
                  "0 0 24px 6px rgba(0,175,240,0.48)",
                  "0 0 0 0 rgba(0,175,240,0)",
                ]
              : [
                  "0 0 0 0 rgba(0,175,240,0)",
                  "0 0 32px 10px rgba(0,175,240,0.38)",
                  "0 0 0 0 rgba(0,175,240,0)",
                ],
          }}
          transition={{
            duration: 2.75,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Image
            src="/favicon.svg"
            alt=""
            width={36}
            height={36}
            className="relative z-[1] h-9 w-9 rounded-lg"
            priority
          />
        </motion.span>
        <span
          className={
            light
              ? "text-sm font-semibold tracking-tight text-slate-900 sm:text-base"
              : "text-sm font-semibold tracking-tight text-white sm:text-base"
          }
        >
          {t.brandName}
        </span>
      </Link>
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <LanguageSelector />
        <UserActionsToolbar lang={lang} surface={light ? "light" : "dark"} />
      </div>
    </nav>
  );
}
