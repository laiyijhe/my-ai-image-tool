"use client";

import { AnimatePresence, motion } from "framer-motion";
import { replacePortalTpl } from "./portal-utils";

type GroupOption = { id: string; label: string };

type ActionBarProps = {
  selectedCount: number;
  groupOptions: GroupOption[];
  selectedGroupIds: string[];
  onToggleGroup: (groupId: string) => void;
  onApplyMove: () => void;
  onBatchProtectPdf: () => void;
  onClearSelection: () => void;
  labels: {
    countTpl: string;
    manageTagsLabel: string;
    apply: string;
    clear: string;
    batchProtectPdf: string;
    clearAria: string;
  };
};

export function ActionBar({
  selectedCount,
  groupOptions,
  selectedGroupIds,
  onToggleGroup,
  onApplyMove,
  onBatchProtectPdf,
  onClearSelection,
  labels,
}: ActionBarProps) {
  const selectedSet = new Set(selectedGroupIds);

  return (
    <AnimatePresence>
      {selectedCount > 0 ? (
        <motion.div
          key="portal-action-bar"
          role="toolbar"
          aria-label={replacePortalTpl(labels.countTpl, {
            count: String(selectedCount),
          })}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
          className="fixed bottom-0 left-0 right-0 z-[110] border-t border-slate-200 bg-canvas/95 px-4 py-3 shadow-[0_-8px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:px-6"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 text-sm font-medium text-ink">
                {replacePortalTpl(labels.countTpl, {
                  count: String(selectedCount),
                })}
              </p>
              <button
                type="button"
                onClick={onClearSelection}
                aria-label={labels.clearAria}
                title={labels.clear}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-canvas-subtle text-lg font-light leading-none text-ink transition hover:border-slate-300 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <button
              type="button"
              onClick={onBatchProtectPdf}
              className="w-full rounded-xl bg-of-500 px-4 py-3 text-sm font-bold text-white shadow-md shadow-of-500/25 transition hover:bg-of-600"
            >
              {labels.batchProtectPdf}
            </button>

            <fieldset className="min-w-0 space-y-2 border-0 p-0">
              <legend className="sr-only">{labels.manageTagsLabel}</legend>
              <p className="text-xs font-medium text-ink-muted">
                {labels.manageTagsLabel}
              </p>
              <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-canvas-subtle p-2">
                {groupOptions.map((g) => (
                  <label
                    key={g.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-canvas px-2.5 py-1.5 text-xs text-ink transition hover:border-of-500/35 hover:bg-of-500/5"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSet.has(g.id)}
                      onChange={() => onToggleGroup(g.id)}
                      className="h-3.5 w-3.5 rounded border-slate-300 bg-canvas text-of-500 focus:ring-of-500/40"
                    />
                    <span className="max-w-[10rem] truncate">{g.label}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={onApplyMove}
                className="w-full rounded-xl border border-of-500/40 bg-of-500/10 px-5 py-2.5 text-sm font-semibold text-of-700 transition hover:bg-of-500/15 sm:self-stretch"
              >
                {labels.apply}
              </button>
            </fieldset>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
