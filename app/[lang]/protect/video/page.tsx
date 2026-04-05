"use client";

import { useLanguage } from "@/lib/i18n/language-context";

export default function ProtectVideoComingPage() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen px-4 py-10 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {t.protectVideoComingTitle}
        </h1>
        <div className="mt-8 rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-950/35 via-slate-950/80 to-sky-950/25 p-8 shadow-[0_0_60px_rgba(217,70,239,0.07)] ring-1 ring-fuchsia-500/20">
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-fuchsia-400/85">
            Creator Guard
          </p>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            {t.protectVideoComingBody}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-fuchsia-200/90">
              Temporal keyframes
            </span>
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-sky-200/90">
              Motion-compensated carrier
            </span>
            <span className="rounded-full border border-slate-600/50 bg-slate-900/60 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Chunk attestations
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
