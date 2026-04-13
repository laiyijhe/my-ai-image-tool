"use client";

import { LanguageSelector } from "@/components/LanguageSelector";
import { UserActionsToolbar } from "@/components/navigation/UserActionsToolbar";
import { isLocale } from "@/lib/i18n/dictionary";
import { useLanguage } from "@/lib/i18n/language-context";
import type { Locale } from "@/lib/i18n/types";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useRef, useState } from "react";

const SIDEBAR_COLLAPSED_PX = 72;
const SIDEBAR_EXPANDED_PX = 240;

/** Slightly overdamped vs V8.3 so main-column reflow does not thrash line breaks while the rail expands. */
const sidebarSpring = {
  type: "spring" as const,
  stiffness: 320,
  damping: 44,
  mass: 1,
};

function IconPdf({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

function IconImage({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}

function IconVideo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="5" width="14" height="14" rx="2" />
      <path d="m22 9-4 3 4 3V9Z" />
    </svg>
  );
}

function IconVerify({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5 11 16 17 9" />
    </svg>
  );
}

const LOCALE_RE = /^\/(en|zh-TW|zh-CN|ja|ko)(\/|$)/;

function isVerifyPath(p: string) {
  if (p === "/verify" || p.startsWith("/verify/")) return true;
  return /^\/(en|zh-TW|zh-CN|ja|ko)\/verify(\/|$)/.test(p);
}

function matchProtectPdf(p: string) {
  if (p.startsWith("/protect/pdf")) return true;
  return /^\/(en|zh-TW|zh-CN|ja|ko)\/protect\/pdf(\/|$)/.test(p);
}

function matchProtectImage(p: string) {
  if (p.startsWith("/protect/image")) return true;
  return /^\/(en|zh-TW|zh-CN|ja|ko)\/protect\/image(\/|$)/.test(p);
}

function matchProtectVideo(p: string) {
  if (p.startsWith("/protect/video")) return true;
  return /^\/(en|zh-TW|zh-CN|ja|ko)\/protect\/video(\/|$)/.test(p);
}

type IconComp = typeof IconPdf;

function SidebarNavLink({
  href,
  active,
  label,
  icon: Icon,
  subtitle,
  expanded,
}: {
  href: string;
  active: boolean;
  label: string;
  icon: IconComp;
  subtitle?: string;
  expanded: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [glow, setGlow] = useState({ x: 50, y: 50 });

  const onMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setGlow({
      x: Math.max(5, Math.min(95, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.max(5, Math.min(95, ((e.clientY - r.top) / r.height) * 100)),
    });
  };

  const tooltip =
    subtitle && subtitle.length > 0 ? `${label} — ${subtitle}` : label;

  return (
    <Link
      ref={ref}
      href={href}
      title={!expanded ? tooltip : undefined}
      onMouseMove={onMove}
      onMouseLeave={() => setGlow({ x: 50, y: 50 })}
      className={`group relative flex items-center overflow-hidden rounded-xl py-2.5 text-sm font-medium transition-[color,box-shadow] duration-200 ${
        expanded ? "gap-3 px-3" : "justify-center px-0"
      } ${
        active
          ? "bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/35"
          : "text-slate-400 hover:text-slate-200"
      } cg-press`}
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(120px circle at ${glow.x}% ${glow.y}%, rgba(255,255,255,0.14), transparent 68%)`,
        }}
        aria-hidden
      />
      {active && expanded ? (
        <span
          className="absolute left-0 top-1/2 z-[2] h-9 w-[2px] -translate-y-1/2 rounded-full bg-gradient-to-b from-cyan-400 via-sky-400 to-emerald-400 shadow-[0_0_16px_rgba(34,211,238,0.9),0_0_8px_rgba(16,185,129,0.5)]"
          aria-hidden
        />
      ) : null}
      <Icon
        className={`relative z-[3] shrink-0 transition-colors ${
          active ? "text-sky-300" : "text-slate-500 group-hover:text-slate-300"
        }`}
      />
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.span
            key="nav-label"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ type: "spring", stiffness: 480, damping: 38 }}
            className={`relative z-[3] min-w-0 flex-1 ${
              subtitle ? "flex flex-col" : "truncate"
            }`}
          >
            <span className="truncate">{label}</span>
            {subtitle ? (
              <span className="truncate text-[10px] font-normal normal-case tracking-normal text-slate-500">
                {subtitle}
              </span>
            ) : null}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </Link>
  );
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const { t } = useLanguage();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const langFromPath: Locale | null =
    typeof params?.lang === "string" && isLocale(params.lang)
      ? params.lang
      : null;

  const langFromUrl = (): Locale | null => {
    const m = pathname.match(LOCALE_RE);
    if (m?.[1] && isLocale(m[1])) return m[1] as Locale;
    return null;
  };

  const lang: Locale = langFromPath ?? langFromUrl() ?? "en";
  const base = `/${lang}`;

  type ProtectNav = {
    href: string;
    label: string;
    icon: IconComp;
    match: (p: string) => boolean;
    subtitle?: string;
  };

  const protectItems: ProtectNav[] = [
    {
      href: `${base}/protect/pdf`,
      label: t.dashboardNavPdfGuard,
      icon: IconPdf,
      match: matchProtectPdf,
    },
    {
      href: `${base}/protect/image`,
      label: t.dashboardNavImageGuard,
      icon: IconImage,
      match: matchProtectImage,
    },
    {
      href: `${base}/protect/video`,
      label: t.dashboardNavVideoGuard,
      icon: IconVideo,
      match: matchProtectVideo,
      subtitle: t.dashboardNavVideoSoon,
    },
  ];

  const verifyItem = {
    href: `${base}/verify`,
    label: t.dashboardNavVerifyHub,
    icon: IconVerify,
    match: isVerifyPath,
  } as const;

  const expanded = !isCollapsed;

  const onSidebarEnter = () => {
    setIsHovered(true);
    setIsCollapsed(false);
  };

  const onSidebarLeave = () => {
    setIsHovered(false);
    setIsCollapsed(true);
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <motion.aside
        initial={false}
        animate={{
          width: isCollapsed ? SIDEBAR_COLLAPSED_PX : SIDEBAR_EXPANDED_PX,
        }}
        transition={sidebarSpring}
        onMouseEnter={onSidebarEnter}
        onMouseLeave={onSidebarLeave}
        className="fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-white/10 bg-slate-950/80 shadow-[4px_0_24px_rgba(0,0,0,0.35)] backdrop-blur-md"
        aria-label={t.dashboardSuiteLabel}
        aria-expanded={expanded}
        data-collapsed={isCollapsed ? "true" : "false"}
        data-hovered={isHovered ? "true" : "false"}
      >
        <div
          className={`flex h-14 shrink-0 items-center border-b border-white/[0.08] px-2 ${
            expanded ? "justify-start px-4" : "justify-center"
          }`}
        >
          <Link
            href={base}
            title={!expanded ? t.dashboardSuiteLabel : undefined}
            className="cg-press flex min-w-0 items-center gap-2 rounded-lg outline-none ring-sky-500/40 focus-visible:ring-2"
            aria-label={t.dashboardBrandHomeAria}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {expanded ? (
                <motion.span
                  key="suite-title"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                  className="truncate text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90"
                >
                  {t.dashboardSuiteLabel}
                </motion.span>
              ) : (
                <motion.span
                  key="suite-cg"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                  className="text-[10px] font-bold text-sky-400/90"
                >
                  CG
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto p-2">
          {protectItems.map((item) => (
            <SidebarNavLink
              key={item.href}
              href={item.href}
              active={item.match(pathname)}
              label={item.label}
              icon={item.icon}
              subtitle={item.subtitle}
              expanded={expanded}
            />
          ))}

          <div
            className="my-2 border-t border-white/[0.08]"
            role="separator"
            aria-hidden
          />

          <SidebarNavLink
            href={verifyItem.href}
            active={verifyItem.match(pathname)}
            label={verifyItem.label}
            icon={verifyItem.icon}
            expanded={expanded}
          />
        </nav>
        <div className="shrink-0 border-t border-white/[0.08] p-2 sm:p-3">
          <div
            className={`flex ${expanded ? "justify-end" : "justify-center"}`}
          >
            <LanguageSelector />
          </div>
        </div>
      </motion.aside>

      <motion.div
        className="flex min-h-screen min-w-0 flex-1 flex-col"
        initial={false}
        animate={{ paddingLeft: isCollapsed ? SIDEBAR_COLLAPSED_PX : SIDEBAR_EXPANDED_PX }}
        transition={sidebarSpring}
      >
        <header className="sticky top-0 z-30 flex min-h-[3.25rem] shrink-0 items-center justify-end gap-3 border-b border-slate-200/90 bg-canvas/95 px-3 py-2 backdrop-blur-sm sm:min-h-14 sm:px-5 supports-[backdrop-filter]:bg-canvas/85">
          <UserActionsToolbar lang={lang} surface="light" />
        </header>
        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            role="main"
            className="flex-1 bg-canvas"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
