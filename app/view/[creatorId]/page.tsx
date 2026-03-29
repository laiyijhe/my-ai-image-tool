"use client";

import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/lib/i18n/language-context";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const DEBOUNCE_MS = 450;

export default function MemberPortalPage() {
  const { t } = useLanguage();
  const params = useParams();
  const creatorId = useMemo(() => {
    const raw = params.creatorId;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  }, [params.creatorId]);

  const [memberId, setMemberId] = useState("");
  const [debouncedMemberId, setDebouncedMemberId] = useState("");

  useEffect(() => {
    const tmr = window.setTimeout(() => {
      setDebouncedMemberId(memberId.trim());
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(tmr);
  }, [memberId]);

  const imageSrc = useMemo(() => {
    if (!debouncedMemberId) return null;
    const q = encodeURIComponent(debouncedMemberId);
    return `/api/protect?userId=${q}`;
  }, [debouncedMemberId]);

  const [imgError, setImgError] = useState(false);
  useEffect(() => {
    setImgError(false);
  }, [imageSrc]);

  const creatorLabel = creatorId
    ? decodeURIComponent(creatorId)
    : t.creatorFallback;

  return (
    <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-4 py-12 sm:px-6">
      <div className="pointer-events-none absolute right-0 top-4 z-20 sm:right-2">
        <div className="pointer-events-auto">
          <LanguageSelector />
        </div>
      </div>

      <header className="mb-8 pr-28 text-center sm:pr-36">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-400/90">
          {t.brandName}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          {t.memberPortal}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{creatorLabel}</p>
      </header>

      <label
        htmlFor="member-id"
        className="text-sm font-medium text-slate-300"
      >
        {t.enterMemberIdLabel}
      </label>
      <input
        id="member-id"
        type="text"
        autoComplete="off"
        value={memberId}
        onChange={(e) => setMemberId(e.target.value)}
        placeholder={t.memberIdPlaceholder}
        className="mt-2 w-full rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/25"
      />
      <p className="mt-2 text-xs text-slate-500">{t.memberIdHelp}</p>

      <div className="mt-8 flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4">
        {!imageSrc && (
          <p className="text-center text-sm text-slate-500">{t.emptyState}</p>
        )}
        {imageSrc && imgError && (
          <p className="text-center text-sm text-rose-400/90">
            {t.errorState}
          </p>
        )}
        {imageSrc && !imgError && (
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-800/60 bg-black/40">
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic API URL from user input */}
            <img
              src={imageSrc}
              alt={t.protectedContentAlt}
              className="h-auto w-full object-contain"
              onError={() => setImgError(true)}
              onLoad={() => setImgError(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
