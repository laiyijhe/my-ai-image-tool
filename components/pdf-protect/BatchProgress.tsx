"use client";

import { useLanguage } from "@/lib/i18n/language-context";

type BatchProgressProps = {
  done: number;
  total: number;
  /** For [X/Y] files label in the center. */
  fileCount: number;
  emailsPerFile: number;
};

const R = 52;
const STROKE = 6;
const NORMALIZED_R = R - STROKE / 2;
const CIRC = 2 * Math.PI * NORMALIZED_R;

export function BatchProgress({
  done,
  total,
  fileCount,
  emailsPerFile,
}: BatchProgressProps) {
  const { t } = useLanguage();
  const ringRatio = total > 0 ? Math.min(1, done / total) : 0;
  const dashOffset = CIRC * (1 - ringRatio);

  const filesCompleted =
    emailsPerFile > 0
      ? Math.min(fileCount, Math.floor(done / emailsPerFile))
      : total > 0 && done >= total
        ? fileCount
        : 0;

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="relative mx-auto h-36 w-36 sm:h-40 sm:w-40">
        <svg
          className="h-full w-full -rotate-90"
          viewBox={`0 0 ${R * 2} ${R * 2}`}
          aria-hidden
        >
          <circle
            cx={R}
            cy={R}
            r={NORMALIZED_R}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            className="text-slate-800"
          />
          <circle
            cx={R}
            cy={R}
            r={NORMALIZED_R}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            style={{ strokeDashoffset: dashOffset }}
            className="text-sky-400 transition-[stroke-dashoffset] duration-300 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-2xl font-bold tabular-nums text-white">
            {filesCompleted}
            <span className="text-slate-500">/</span>
            {fileCount}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {t.protectPdfProgressFilesLabel}
          </p>
          {total > 1 ? (
            <p className="mt-1 text-[11px] tabular-nums text-slate-600">
              {done}/{total} {t.protectPdfProgressSteps}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
