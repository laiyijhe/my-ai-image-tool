"use client";

import { BatchProgress } from "@/components/pdf-protect/BatchProgress";
import { FileCard } from "@/components/pdf-protect/FileCard";
import { useCgEmailGroups } from "@/hooks/useCgEmailGroups";
import {
  PDF_BATCH_MAX_COMBOS,
  PDF_CLIENT_MAX_COMBOS,
  parseEmailListFromRaw,
  protectedPdfZipEntryName,
  isPdfFileLike,
  safePdfFileName,
} from "@/lib/pdf-protect-shared";
import JSZip from "jszip";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";

type Progress = { done: number; total: number };

type BatchLogRow = {
  id: string;
  fileName: string;
  email: string;
  emailSent: boolean;
};

function MailLetterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

async function sendProtectedPdfEmail(
  blob: Blob,
  to: string,
  attachmentFileName: string
): Promise<void> {
  const fd = new FormData();
  fd.set("to", to);
  fd.set(
    "file",
    new File([blob], attachmentFileName, { type: "application/pdf" })
  );
  const res = await fetch("/api/send/pdf", { method: "POST", body: fd });
  const j = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    throw new Error(j.message ?? `Email send failed (${res.status})`);
  }
}

export default function ProtectPdfPage() {
  const { groups, hydrated, upsertGroup, removeGroup, sortedNames } =
    useCgEmailGroups();
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [emailListText, setEmailListText] = useState("");
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(
    null
  );
  const [selectValue, setSelectValue] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [sendEmailAfterProtection, setSendEmailAfterProtection] =
    useState(false);
  const [batchSendLog, setBatchSendLog] = useState<BatchLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const next = acceptedFiles.filter(isPdfFileLike);
    if (acceptedFiles.length > 0 && next.length === 0) {
      setError("No valid PDFs (PDF only, max 25 MB each).");
    } else if (next.length < acceptedFiles.length) {
      setError("Some files were skipped (PDF only, max 25 MB each).");
    } else if (next.length > 0) {
      setError(null);
    }
    setPdfFiles((prev) => [...prev, ...next]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
    disabled: loading,
  });

  const parsedEmails = useMemo(
    () => parseEmailListFromRaw(emailListText),
    [emailListText]
  );

  const comboCount = pdfFiles.length * parsedEmails.length;
  const emailsPerFile = parsedEmails.length;

  const removeFile = useCallback((index: number) => {
    setPdfFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const applyGroup = useCallback(
    (name: string) => {
      const emails = groups[name];
      if (!emails?.length) return;
      setSelectedGroupName(name);
      setSelectValue(name);
      setEmailListText(emails.join("\n"));
      setError(null);
    },
    [groups]
  );

  const onSelectGroupDropdown = useCallback(
    (value: string) => {
      setSelectValue(value);
      if (!value) {
        setSelectedGroupName(null);
        return;
      }
      applyGroup(value);
    },
    [applyGroup]
  );

  const saveAsGroup = useCallback(() => {
    const name = newGroupName.trim();
    const emails = parseEmailListFromRaw(emailListText);
    if (!name) {
      setError("Enter a name for the group (e.g. 狗狗沃克班).");
      return;
    }
    if (emails.length === 0) {
      setError("Paste at least one valid email before saving the group.");
      return;
    }
    upsertGroup(name, emails);
    setSelectedGroupName(name);
    setSelectValue(name);
    setNewGroupName("");
    setError(null);
  }, [emailListText, newGroupName, upsertGroup]);

  const onEmailTextChange = useCallback((value: string) => {
    setEmailListText(value);
    setSelectedGroupName(null);
    setSelectValue("");
  }, []);

  const runBatch = useCallback(async () => {
    setError(null);
    setProgress(null);
    setBatchSendLog([]);

    const emails = parseEmailListFromRaw(emailListText);
    if (pdfFiles.length === 0) {
      setError("Add at least one PDF (drop files or use the zone below).");
      return;
    }
    if (emails.length === 0) {
      setError("Select a contact group or enter at least one valid email.");
      return;
    }

    const invalid = pdfFiles.filter((f) => !isPdfFileLike(f));
    if (invalid.length > 0) {
      setError(
        `Each PDF must be ≤ 25 MB and named .pdf. Check: ${invalid.map((f) => f.name).join(", ")}`
      );
      return;
    }

    const tasks: { file: File; email: string }[] = [];
    for (const file of pdfFiles) {
      for (const email of emails) {
        tasks.push({ file, email });
      }
    }

    if (tasks.length > PDF_CLIENT_MAX_COMBOS) {
      setError(
        `Too many combinations (${tasks.length}). Maximum ${PDF_CLIENT_MAX_COMBOS} (files × emails). Split into smaller batches.`
      );
      return;
    }

    setLoading(true);
    setProgress({ done: 0, total: tasks.length });

    try {
      if (tasks.length === 1) {
        const { file, email } = tasks[0]!;
        const postFd = new FormData();
        postFd.set("file", file);
        postFd.set("buyerEmail", email);

        const res = await fetch("/api/protect/pdf", {
          method: "POST",
          body: postFd,
        });

        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(j?.message ?? `Request failed (${res.status})`);
        }

        const blob = await res.blob();
        const downloadName =
          res.headers
            .get("Content-Disposition")
            ?.match(/filename="([^"]+)"/)?.[1] ?? safePdfFileName(file.name);

        let emailSent = false;
        if (sendEmailAfterProtection) {
          await sendProtectedPdfEmail(blob, email, downloadName);
          emailSent = true;
        }

        setBatchSendLog([
          {
            id: "0",
            fileName: file.name,
            email,
            emailSent,
          },
        ]);

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = downloadName;
        a.click();
        URL.revokeObjectURL(url);
        setProgress({ done: 1, total: 1 });
        return;
      }

      const zip = new JSZip();

      for (let i = 0; i < tasks.length; i++) {
        const { file, email } = tasks[i]!;
        const postFd = new FormData();
        postFd.set("file", file);
        postFd.set("buyerEmail", email);

        const res = await fetch("/api/protect/pdf", {
          method: "POST",
          body: postFd,
        });

        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(
            j?.message ??
              `Failed on ${file.name} × ${email} (${res.status})`
          );
        }

        const blob = await res.blob();
        const zipEntryName = protectedPdfZipEntryName(file.name, email, i);

        let emailSent = false;
        if (sendEmailAfterProtection) {
          await sendProtectedPdfEmail(blob, email, zipEntryName);
          emailSent = true;
        }

        zip.file(zipEntryName, blob);
        setBatchSendLog((prev) => [
          ...prev,
          {
            id: `${i}-${file.name}-${email}`,
            fileName: file.name,
            email,
            emailSent,
          },
        ]);
        setProgress({ done: i + 1, total: tasks.length });
      }

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `creator-guard-batch-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [emailListText, pdfFiles, sendEmailAfterProtection]);

  return (
    <main className="min-h-screen px-4 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10">
          <Link
            href="/"
            className="text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
          >
            ← Creator Guard home
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            PDF Guard · Batch
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Drop PDFs on the left, load a saved contact group or paste emails on
            the right, then start batch protection. Multiple outputs are zipped
            with <span className="text-slate-300">JSZip</span>.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-10">
          {/* Left ~40% */}
          <section className="flex flex-col gap-4 lg:col-span-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Files
            </h2>
            <div
              {...getRootProps()}
              className={`flex min-h-[11rem] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 transition ${
                isDragActive
                  ? "border-sky-400/70 bg-sky-500/10"
                  : "border-slate-600/70 bg-slate-900/40 hover:border-slate-500"
              } ${loading ? "pointer-events-none opacity-50" : ""}`}
            >
              <input {...getInputProps()} />
              <p className="text-center text-sm font-medium text-slate-200">
                {isDragActive
                  ? "Drop PDFs here…"
                  : "Drag & drop PDFs, or click to browse"}
              </p>
              <p className="mt-2 text-center text-xs text-slate-500">
                Multiple files · max 25 MB each
              </p>
            </div>

            <div className="space-y-2">
              {pdfFiles.length === 0 ? (
                <p className="rounded-xl border border-slate-800/80 bg-slate-950/30 px-4 py-6 text-center text-sm text-slate-500">
                  No files yet
                </p>
              ) : (
                pdfFiles.map((f, idx) => (
                  <FileCard
                    key={`${idx}-${f.name}-${f.size}`}
                    file={f}
                    onRemove={() => removeFile(idx)}
                  />
                ))
              )}
            </div>
          </section>

          {/* Right ~60% */}
          <section className="flex flex-col gap-5 lg:col-span-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Contact book & batch
            </h2>

            {(loading && progress) || batchSendLog.length > 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">
                {loading && progress ? (
                  <>
                    <p className="mb-1 text-center text-xs font-medium text-slate-500">
                      Batch running
                    </p>
                    <BatchProgress
                      done={progress.done}
                      total={progress.total}
                      fileCount={pdfFiles.length}
                      emailsPerFile={emailsPerFile || 1}
                    />
                  </>
                ) : (
                  <p className="mb-3 text-center text-xs font-medium text-slate-500">
                    Last batch
                  </p>
                )}
                {batchSendLog.length > 0 ? (
                  <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto border-t border-slate-800/80 pt-3">
                    {batchSendLog.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-center gap-2 text-xs text-slate-400"
                      >
                        <span
                          className="min-w-0 flex-1 truncate font-medium text-slate-300"
                          title={row.fileName}
                        >
                          {row.fileName}
                        </span>
                        <span
                          className="max-w-[40%] truncate text-slate-500"
                          title={row.email}
                        >
                          {row.email}
                        </span>
                        {row.emailSent ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-0.5 text-emerald-400/90"
                            title="Email sent"
                          >
                            <MailLetterIcon className="text-emerald-400/90" />
                          </span>
                        ) : (
                          <span className="w-[18px] shrink-0" aria-hidden />
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="select-email-group"
                    className="text-sm font-medium text-slate-300"
                  >
                    Select group
                  </label>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Saved in{" "}
                    <code className="text-slate-600">cg_email_groups</code>
                    {!hydrated ? " · loading…" : null}
                  </p>
                  <select
                    id="select-email-group"
                    value={selectValue}
                    onChange={(e) => onSelectGroupDropdown(e.target.value)}
                    disabled={loading || !hydrated || sortedNames.length === 0}
                    className="mt-2 w-full max-w-md appearance-none rounded-full border border-sky-500/35 bg-sky-500/10 bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat py-2.5 pl-4 pr-10 text-sm font-medium text-sky-100 shadow-sm outline-none transition hover:border-sky-400/50 hover:bg-sky-500/15 focus:ring-2 focus:ring-sky-500/30 disabled:cursor-not-allowed disabled:opacity-45"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2367e8f9'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                    }}
                  >
                    <option value="">— Pick a contact group —</option>
                    {sortedNames.map((name) => (
                      <option key={name} value={name}>
                        {name} ({groups[name]?.length ?? 0})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {sortedNames.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                    Quick badges
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sortedNames.map((name) => {
                      const count = groups[name]?.length ?? 0;
                      const active = selectedGroupName === name;
                      return (
                        <div
                          key={name}
                          className={`inline-flex items-stretch overflow-hidden rounded-full border text-sm font-medium transition ${
                            active
                              ? "border-sky-400/60 bg-sky-500/20 text-sky-100 ring-2 ring-sky-400/25"
                              : "border-slate-600/80 bg-slate-800/60 text-slate-300"
                          }`}
                        >
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => applyGroup(name)}
                            className="inline-flex max-w-[12rem] items-center gap-1.5 px-3 py-1.5 transition hover:bg-white/5 disabled:opacity-45"
                          >
                            <span className="truncate">{name}</span>
                            <span
                              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                                active
                                  ? "bg-sky-950/50 text-sky-200"
                                  : "bg-slate-950/40 text-slate-400"
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            title="Remove group"
                            aria-label={`Remove group ${name}`}
                            onClick={() => {
                              removeGroup(name);
                              if (selectedGroupName === name) {
                                setSelectedGroupName(null);
                                setSelectValue("");
                              }
                            }}
                            className="border-l border-slate-600/60 px-2 text-slate-500 transition hover:bg-red-950/60 hover:text-red-200 disabled:opacity-45"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : hydrated ? (
                <p className="rounded-xl border border-dashed border-slate-700/80 bg-slate-950/20 px-4 py-4 text-sm text-slate-500">
                  No groups yet. Paste emails in the box below, name the group,
                  and click <strong className="text-slate-400">Save as Group</strong>.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="email-list"
                className="text-sm font-medium text-slate-300"
              >
                Emails for this batch
              </label>
              <textarea
                id="email-list"
                value={emailListText}
                onChange={(e) => onEmailTextChange(e.target.value)}
                rows={7}
                disabled={loading}
                placeholder={
                  "buyer1@example.com\nbuyer2@example.com\nor comma / semicolon separated"
                }
                className="min-h-[10rem] w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  disabled={loading}
                  placeholder="Group name (e.g. 狗狗沃克班)"
                  className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
                  aria-label="New contact group name"
                />
                <button
                  type="button"
                  onClick={saveAsGroup}
                  disabled={loading}
                  className="shrink-0 rounded-xl border border-emerald-600/50 bg-emerald-950/40 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-900/50 disabled:opacity-50"
                >
                  Save as Group
                </button>
              </div>
              <p className="text-xs text-slate-500">
                {parsedEmails.length} valid email
                {parsedEmails.length === 1 ? "" : "s"}
                {comboCount > 0
                  ? ` · ${comboCount} output${comboCount === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4 transition hover:border-slate-700">
              <input
                type="checkbox"
                checked={sendEmailAfterProtection}
                onChange={(e) =>
                  setSendEmailAfterProtection(e.target.checked)
                }
                disabled={loading}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500/30"
              />
              <span className="text-sm leading-snug text-slate-300">
                <span className="font-medium text-slate-200">
                  Send to recipients via Email after protection
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  Uses Resend. Set{" "}
                  <code className="rounded bg-slate-800 px-1 text-slate-400">
                    RESEND_API_KEY
                  </code>{" "}
                  in{" "}
                  <code className="rounded bg-slate-800 px-1 text-slate-400">
                    .env.local
                  </code>
                  . Each protected PDF is emailed to its buyer address.
                </span>
              </span>
            </label>

            {error ? (
              <p className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void runBatch()}
              disabled={loading}
              className="rounded-xl bg-sky-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? progress && progress.total > 1
                  ? `Protecting… ${progress.done}/${progress.total}`
                  : "Protecting…"
                : "Start batch protection"}
            </button>

            <p className="text-[11px] leading-relaxed text-slate-600">
              One output = direct PDF download. Multiple = sequential API calls
              then one ZIP. Server batch (max {PDF_BATCH_MAX_COMBOS} combos):{" "}
              <code className="rounded bg-slate-800 px-1">POST /api/protect/pdf/batch</code>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
