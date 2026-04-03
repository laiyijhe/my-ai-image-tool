"use client";

import { useLanguage } from "@/lib/i18n/language-context";

type FileCardProps = {
  file: File;
  onRemove: () => void;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function FileCard({ file, onRemove }: FileCardProps) {
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
