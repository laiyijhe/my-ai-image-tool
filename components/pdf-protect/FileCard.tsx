"use client";

import { useLanguage } from "@/lib/i18n/language-context";
import type { Messages } from "@/lib/i18n/types";

export type PdfQueueStatus = "pending" | "protecting" | "ready";

type FileCardProps = {
  file: File;
  onRemove: () => void;
  queueStatus?: PdfQueueStatus;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function statusLabel(s: PdfQueueStatus, t: Messages) {
  if (s === "protecting") return t.protectPdfQueueProtecting;
  if (s === "ready") return t.protectPdfQueueReady;
  return t.protectPdfQueuePending;
}

function statusClass(s: PdfQueueStatus) {
  if (s === "protecting") return "bg-amber-500/20 text-amber-200 ring-amber-500/30";
  if (s === "ready") return "bg-emerald-500/20 text-emerald-200 ring-emerald-500/30";
  return "bg-slate-700/50 text-slate-400 ring-slate-600/40";
}

export function FileCard({ file, onRemove, queueStatus }: FileCardProps) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-400/90">
        <span className="text-[10px] font-bold uppercase tracking-tighter">
          {t.protectPdfBadgePdf}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-100" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-slate-500">{formatSize(file.size)}</p>
      </div>
      {queueStatus ? (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${statusClass(queueStatus)}`}
        >
          {statusLabel(queueStatus, t)}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-lg border border-slate-600/80 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:border-red-500/40 hover:bg-red-950/40 hover:text-red-200"
      >
        {t.protectPdfFileRemove}
      </button>
    </div>
  );
}
