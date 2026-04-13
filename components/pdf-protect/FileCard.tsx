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
  if (s === "protecting")
    return "bg-amber-100 text-amber-900 ring-amber-200";
  if (s === "ready") return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

export function FileCard({ file, onRemove, queueStatus }: FileCardProps) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
        <span className="text-[10px] font-bold uppercase tracking-tighter">
          {t.protectPdfBadgePdf}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900" title={file.name}>
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
        className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
      >
        {t.protectPdfFileRemove}
      </button>
    </div>
  );
}
