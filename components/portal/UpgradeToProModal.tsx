"use client";

import Link from "next/link";

export type UpgradeToProModalLabels = {
  title: string;
  body: string;
  cta: string;
  dismiss: string;
};

export function UpgradeToProModal({
  open,
  onClose,
  pricingHref,
  labels,
}: {
  open: boolean;
  onClose: () => void;
  pricingHref: string;
  labels: UpgradeToProModalLabels;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cg-upgrade-title"
    >
      <button
        type="button"
        aria-label={labels.dismiss}
        className="absolute inset-0 bg-ink/25 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-canvas shadow-xl shadow-slate-200/50">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-of-500/40 to-transparent" />
        <div className="p-6 sm:p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-violet-800">
            <span
              className="h-1.5 w-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.45)]"
              aria-hidden
            />
            Pro
          </div>
          <h2
            id="cg-upgrade-title"
            className="text-xl font-semibold tracking-tight text-ink sm:text-2xl"
          >
            {labels.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            {labels.body}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="order-2 rounded-xl border border-slate-200 bg-canvas-subtle px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-slate-100 sm:order-1"
            >
              {labels.dismiss}
            </button>
            <Link
              href={pricingHref}
              onClick={onClose}
              className="order-1 inline-flex items-center justify-center rounded-xl bg-of-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-of-500/20 transition hover:bg-of-600 sm:order-2"
            >
              {labels.cta}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
