"use client";

import { useAuthModal } from "@/components/auth/auth-modal-context";
import { UserBadge } from "@/components/navigation/UserBadge";
import { useLanguage } from "@/lib/i18n/language-context";
import { useSupabaseAuth } from "@/lib/supabase-auth-context";
import type { Locale } from "@/lib/i18n/types";
import { motion } from "framer-motion";
import Link from "next/link";

type UserActionsToolbarProps = {
  lang: Locale;
  /** V7.3+ dashboards use light surfaces. */
  surface?: "light" | "dark";
};

export function UserActionsToolbar({
  lang,
  surface = "light",
}: UserActionsToolbarProps) {
  const { t } = useLanguage();
  const { user, authAvailable } = useSupabaseAuth();
  const { openAuthModal } = useAuthModal();
  const light = surface === "light";
  const lp = `/${lang}`;
  const portalHref = `${lp}/portal`;

  return (
    <div
      className="flex flex-wrap items-center justify-end gap-2 sm:gap-3"
      aria-label="User actions"
    >
      {user ? (
        <>
          <Link
            href={portalHref}
            className={
              light
                ? "relative inline-flex min-h-[40px] min-w-0 max-w-full items-center justify-center overflow-hidden rounded-full bg-[#00AFF0] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_22px_rgba(0,175,240,0.42)] transition hover:brightness-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00AFF0]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                : "relative inline-flex min-h-[40px] min-w-0 max-w-full items-center justify-center overflow-hidden rounded-full bg-[#00AFF0] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_24px_rgba(0,175,240,0.35)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            }
          >
            <motion.span
              className="pointer-events-none absolute inset-0 rounded-full bg-white/35"
              aria-hidden
              animate={{
                opacity: [0.12, 0.38, 0.12],
                scale: [1, 1.045, 1],
              }}
              transition={{
                duration: 2.35,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <span className="relative z-[1] truncate px-0.5 text-center">
              {t.navManageMembersGroups}
            </span>
          </Link>
          <UserBadge surface={light ? "light" : "dark"} />
        </>
      ) : authAvailable ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openAuthModal()}
            className={
              light
                ? "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                : "rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-500/35 hover:bg-white/[0.1]"
            }
          >
            {t.navLogIn}
          </button>
          <button
            type="button"
            onClick={() => openAuthModal()}
            className="rounded-full bg-[#00AFF0] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            {t.navSignUp}
          </button>
        </div>
      ) : null}
    </div>
  );
}
