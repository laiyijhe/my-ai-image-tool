"use client";

/** Submits to parent; members persist under localStorage key `cg-members` (see portal-manual-members-storage). */

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useId, useState } from "react";
export type AddMemberFormValues = {
  identityId: string;
  source: string;
  /** Empty = 待審核 */
  groupIds: string[];
};

type AddMemberModalProps = {
  open: boolean;
  onClose: () => void;
  /** value "" = 待審核；其餘為群組 id（含系統群組） */
  initialGroupOptions: { value: string; label: string }[];
  onSubmit: (values: AddMemberFormValues) => void;
  labels: {
    title: string;
    identity: string;
    identityPlaceholder: string;
    source: string;
    sourcePlaceholder: string;
    initialGroup: string;
    submit: string;
    cancel: string;
    errEmptyIdentity: string;
  };
};

export function AddMemberModal({
  open,
  onClose,
  initialGroupOptions,
  onSubmit,
  labels,
}: AddMemberModalProps) {
  const baseId = useId();
  const [identityId, setIdentityId] = useState("");
  const [source, setSource] = useState("");
  const [groupSelect, setGroupSelect] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIdentityId("");
    setSource("");
    setGroupSelect("");
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const id = identityId.trim();
      if (!id) {
        setError(labels.errEmptyIdentity);
        return;
      }
      setError(null);
      onSubmit({
        identityId: id,
        source: source.trim(),
        groupIds: groupSelect === "" ? [] : [groupSelect],
      });
      onClose();
    },
    [groupSelect, identityId, labels.errEmptyIdentity, onClose, onSubmit, source]
  );

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="add-member-modal"
          className="fixed inset-0 z-[130] flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label={labels.cancel}
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-labelledby={`${baseId}-title`}
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-canvas shadow-xl shadow-slate-200/60 ring-1 ring-of-500/15"
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h2
                id={`${baseId}-title`}
                className="text-lg font-semibold text-ink"
              >
                {labels.title}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="px-5 py-4">
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor={`${baseId}-identity`}
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted"
                  >
                    {labels.identity}
                  </label>
                  <input
                    id={`${baseId}-identity`}
                    type="text"
                    value={identityId}
                    onChange={(e) => {
                      setIdentityId(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={labels.identityPlaceholder}
                    autoComplete="off"
                    className="w-full rounded-xl border border-slate-200 bg-canvas-subtle px-3 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:border-of-500/45 focus:outline-none focus:ring-2 focus:ring-of-500/15"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${baseId}-source`}
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted"
                  >
                    {labels.source}
                  </label>
                  <input
                    id={`${baseId}-source`}
                    type="text"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder={labels.sourcePlaceholder}
                    autoComplete="off"
                    className="w-full rounded-xl border border-slate-200 bg-canvas-subtle px-3 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:border-of-500/45 focus:outline-none focus:ring-2 focus:ring-of-500/15"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${baseId}-group`}
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted"
                  >
                    {labels.initialGroup}
                  </label>
                  <select
                    id={`${baseId}-group`}
                    value={groupSelect}
                    onChange={(e) => setGroupSelect(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-canvas-subtle px-3 py-2.5 text-sm text-ink focus:border-of-500/50 focus:outline-none focus:ring-2 focus:ring-of-500/15"
                  >
                    {initialGroupOptions.map((opt) => (
                      <option key={opt.value || "__pending"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {error ? (
                  <p className="text-sm text-rose-600" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 bg-canvas-subtle px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-slate-100"
                >
                  {labels.cancel}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-of-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-of-500/20 transition hover:bg-of-600"
                >
                  {labels.submit}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
