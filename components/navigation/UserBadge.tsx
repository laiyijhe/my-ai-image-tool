"use client";

import { useCreatorPlan } from "@/hooks/useCreatorPlan";
import { useLanguage } from "@/lib/i18n/language-context";
import { useSupabaseAuth } from "@/lib/supabase-auth-context";
import { isSupabaseConfigured } from "@/lib/supabase-client";
import { isPaidPlan } from "@/lib/plan-types";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

function oauthAvatarUrl(user: User): string | null {
  const m = user.user_metadata;
  if (typeof m?.avatar_url === "string" && m.avatar_url.trim()) {
    return m.avatar_url.trim();
  }
  if (typeof m?.picture === "string" && m.picture.trim()) {
    return m.picture.trim();
  }
  const google = user.identities?.find((i) => i.provider === "google");
  const gd = google?.identity_data;
  if (gd && typeof gd === "object") {
    const rec = gd as Record<string, unknown>;
    if (typeof rec.avatar_url === "string" && rec.avatar_url.trim()) {
      return rec.avatar_url.trim();
    }
    if (typeof rec.picture === "string" && rec.picture.trim()) {
      return rec.picture.trim();
    }
  }
  const fb = user.identities?.find((i) => i.provider === "facebook");
  const fd = fb?.identity_data;
  if (fd && typeof fd === "object") {
    const rec = fd as Record<string, unknown>;
    if (typeof rec.picture === "string" && rec.picture.trim()) {
      return rec.picture.trim();
    }
    if (typeof rec.avatar_url === "string" && rec.avatar_url.trim()) {
      return rec.avatar_url.trim();
    }
  }
  return null;
}

function displayName(user: User): string {
  const meta = user.user_metadata;
  if (typeof meta?.full_name === "string" && meta.full_name.trim()) {
    return meta.full_name.trim();
  }
  if (typeof meta?.name === "string" && meta.name.trim()) {
    return meta.name.trim();
  }
  if (user.email?.trim()) return user.email.trim();
  return "User";
}

type UserBadgeProps = {
  surface?: "dark" | "light";
};

export function UserBadge({ surface = "light" }: UserBadgeProps) {
  const { t, locale } = useLanguage();
  const { planType, loading: planLoading } = useCreatorPlan();
  const { user, loading, signOut, authAvailable } = useSupabaseAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const light = surface === "light";
  const pricingHref = `/${locale}/pricing`;

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const onLogout = useCallback(async () => {
    setMenuOpen(false);
    await signOut();
  }, [signOut]);

  if (!isSupabaseConfigured() || !authAvailable) {
    return null;
  }

  if (loading) {
    return (
      <div
        className={
          light
            ? "h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-200"
            : "h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-700/80"
        }
        aria-hidden
      />
    );
  }

  if (!user) {
    return null;
  }

  const avatarUrl = oauthAvatarUrl(user);
  const showPremium = !planLoading && isPaidPlan(planType);
  const label = displayName(user);
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className={
          light
            ? "flex max-w-[min(100%,16rem)] items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/90 sm:pr-3"
            : "flex max-w-[min(100%,16rem)] items-center gap-2 rounded-full border border-white/10 bg-black/30 py-1 pl-1 pr-2.5 transition hover:border-white/20 sm:pr-3"
        }
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={label}
      >
        <span
          className={
            light
              ? "relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-2 ring-slate-100"
              : "relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-800 ring-2 ring-white/10"
          }
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={32}
              height={32}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <span
              className={
                light
                  ? "flex h-full w-full items-center justify-center text-xs font-bold text-of-600"
                  : "flex h-full w-full items-center justify-center text-xs font-bold text-cyan-200"
              }
            >
              {initial}
            </span>
          )}
        </span>
        {showPremium ? (
          <span
            className={
              light
                ? "inline-flex shrink-0 items-center gap-1 rounded-lg border border-violet-200 bg-gradient-to-r from-violet-50 via-fuchsia-50 to-white px-2 py-0.5 text-[11px] font-semibold text-violet-900 shadow-sm ring-1 ring-of-500/15"
                : "inline-flex shrink-0 items-center gap-1 rounded-lg border border-violet-400/35 bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-100/95 shadow-[0_0_16px_rgba(167,139,250,0.2)]"
            }
            title={t.authPremiumMemberBadge}
            aria-label={t.authPremiumMemberBadge}
          >
            <span aria-hidden>💎</span>
            <span className="hidden sm:inline" aria-hidden>
              {t.authPremiumMemberBadge}
            </span>
          </span>
        ) : null}
        <span
          className={
            light
              ? "min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-800"
              : "min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-200"
          }
        >
          {label}
        </span>
      </button>
      {menuOpen ? (
        <div
          className={
            light
              ? "absolute right-0 z-[300] mt-2 min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-200/40"
              : "absolute right-0 z-[300] mt-2 min-w-[11rem] overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 py-1 shadow-2xl backdrop-blur-md"
          }
          role="menu"
        >
          <Link
            href={pricingHref}
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className={
              light
                ? "block px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                : "block px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/[0.06]"
            }
          >
            {t.footerPricing}
          </Link>
          <div
            className={
              light
                ? "mx-2 border-t border-slate-100"
                : "mx-2 border-t border-white/10"
            }
            role="separator"
            aria-hidden
          />
          <button
            type="button"
            role="menuitem"
            onClick={() => void onLogout()}
            className={
              light
                ? "w-full px-4 py-2.5 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                : "w-full px-4 py-2.5 text-left text-sm font-medium text-rose-200/95 transition hover:bg-white/[0.06]"
            }
          >
            {t.authLogout}
          </button>
        </div>
      ) : null}
    </div>
  );
}
