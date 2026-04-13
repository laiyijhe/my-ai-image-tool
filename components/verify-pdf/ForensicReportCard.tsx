"use client";

import { useLanguage } from "@/lib/i18n/language-context";
import {
  formatEmbeddedUtc,
  formatFileSizeBytes,
} from "@/lib/verify-pdf-forensic-meta";
import { forwardRef } from "react";

function tpl(s: string, vars: Record<string, string>): string {
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}

export type ForensicReportCardProps = {
  caseId: string;
  originalFileName: string;
  fileSizeBytes: number;
  pageCount: number;
  sha256: string;
  buyerEmail: string;
  fingerprintId: string;
  embeddedTimestampRaw: string;
  guardVersion: string;
};

export const ForensicReportCard = forwardRef<
  HTMLDivElement,
  ForensicReportCardProps
>(function ForensicReportCard(
  {
    caseId,
    originalFileName,
    fileSizeBytes,
    pageCount,
    sha256,
    buyerEmail,
    fingerprintId,
    embeddedTimestampRaw,
    guardVersion,
  },
  ref
) {
  const { t } = useLanguage();
  const utcDisplay = formatEmbeddedUtc(embeddedTimestampRaw);
  const pagesLabel =
    pageCount > 0 ? String(pageCount) : "—";

  return (
    <div
      ref={ref}
      id="forensic-report-root"
      className="forensic-report-print relative mt-8 overflow-hidden rounded-xl border-2 border-red-600 bg-gradient-to-b from-red-950/90 via-slate-950 to-slate-950 p-6 text-slate-100 shadow-2xl shadow-red-950/50"
      style={{ borderColor: "rgb(220 38 38)" }}
    >
      <div
        className="forensic-watermark-layer pointer-events-none absolute inset-0 overflow-hidden opacity-[0.05]"
        aria-hidden
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="absolute whitespace-nowrap font-black uppercase tracking-[0.4em] text-white"
            style={{
              left: `${(i % 5) * 22 - 8}%`,
              top: `${Math.floor(i / 5) * 42 - 6}%`,
              transform: "rotate(-32deg)",
              fontSize: "clamp(1.25rem, 3.5vw, 2rem)",
            }}
          >
            FORENSIC COPY
          </span>
        ))}
      </div>

      <div className="relative z-[1]">
        <div className="forensic-ghost-pulse-box rounded-lg border border-red-500/50 bg-red-950/20 px-4 py-3 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-red-400">
            {t.verifyPdfGhostDetected}
          </p>
        </div>

        <div className="mt-4 border-y border-red-900/50 bg-black/30 py-4 text-center forensic-print-invert">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-100">
            {t.verifyPdfOfficialReportTitle}
          </h2>
          <p className="forensic-mono-well mx-auto mt-3 max-w-full text-center text-xs text-red-200/95">
            {tpl(t.verifyPdfCaseIdTpl, { caseId: `CG-${caseId}` })}
          </p>
        </div>

        <section className="relative mt-6 space-y-3 border border-slate-700/80 bg-slate-900/50 p-4 forensic-print-invert">
          <h3 className="border-b border-slate-600 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {t.verifyPdfSectionEvidence}
          </h3>
          <dl className="grid gap-2 text-xs sm:grid-cols-1">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <dt className="text-slate-500">{t.verifyPdfLabelOriginalFilename}</dt>
              <dd className="font-mono text-slate-200 break-all text-right">
                {originalFileName}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <dt className="text-slate-500">{t.verifyPdfLabelFileSize}</dt>
              <dd className="font-mono text-slate-200">
                {formatFileSizeBytes(fileSizeBytes)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <dt className="text-slate-500">{t.verifyPdfLabelPageCount}</dt>
              <dd className="font-mono text-slate-200">{pagesLabel}</dd>
            </div>
          </dl>
        </section>

        <section className="relative mt-4 space-y-3 border border-red-900/40 bg-red-950/20 p-4">
          <h3 className="border-b border-red-800/50 pb-2 text-[10px] font-bold uppercase tracking-widest text-red-300/90">
            {t.verifyPdfSectionFindings}
          </h3>
          <dl className="space-y-3 text-xs">
            <div>
              <dt className="text-red-300/80">{t.verifyPdfMemberIdentity}</dt>
              <dd className="forensic-email-highlight mt-1 inline-block max-w-full rounded border border-red-500/40 bg-red-950/60 px-2 py-1.5 font-mono text-sm font-semibold text-red-50 break-all">
                {buyerEmail}
              </dd>
            </div>
            <div>
              <dt className="text-red-300/80">{t.verifyPdfLabelFingerprintId}</dt>
              <dd className="forensic-mono-well mt-1 break-all text-red-100/95">
                {fingerprintId}
              </dd>
            </div>
            <div>
              <dt className="text-red-300/80">{t.verifyPdfLabelUtcRecorded}</dt>
              <dd className="mt-1 font-mono text-red-100/90 break-all">
                {utcDisplay}
              </dd>
            </div>
          </dl>
        </section>

        <section className="relative mt-4 space-y-3 border border-slate-700/80 bg-slate-900/40 p-4 forensic-print-invert">
          <h3 className="border-b border-slate-600 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {t.verifyPdfSectionIntegrity}
          </h3>
          <dl className="space-y-3 text-xs">
            <div>
              <dt className="text-slate-500">{t.verifyPdfLabelGuardVersion}</dt>
              <dd className="mt-1 font-mono text-slate-200">{guardVersion}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t.verifyPdfLabelSha256}</dt>
              <dd className="forensic-mono-well mt-1 break-all text-[10px] leading-relaxed text-slate-300">
                {sha256}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
});
