"use client";

import { BatchProgress } from "@/components/pdf-protect/BatchProgress";
import { FileCard } from "@/components/pdf-protect/FileCard";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useCgEmailGroups } from "@/hooks/useCgEmailGroups";
import {
  appendCgBatchHistory,
  loadCgBatchHistory,
  type CgBatchHistoryEntry,
} from "@/lib/cg-batch-history";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  PDF_BATCH_MAX_COMBOS,
  PDF_CLIENT_MAX_COMBOS,
  emailListsMatch,
  parseEmailListFromRaw,
  protectedPdfZipEntryName,
  isPdfFileLike,
  safePdfFileName,
  suggestGroupLabelFromRaw,
} from "@/lib/pdf-protect-shared";
import JSZip from "jszip";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";

function tpl(s: string, vars: Record<string, string>): string {
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}

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

export default function ProtectPdfPage() {
  const { t, locale } = useLanguage();
  const { groups, hydrated, upsertGroup, removeGroup, sortedNames } =
    useCgEmailGroups();

  const sendProtectedPdfEmail = useCallback(
    async (blob: Blob, to: string, attachmentFileName: string) => {
      const fd = new FormData();
      fd.set("to", to);
      fd.set(
        "file",
        new File([blob], attachmentFileName, { type: "application/pdf" })
      );
      const res = await fetch("/api/send/pdf", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        throw new Error(
          j.message ??
            tpl(t.protectPdfErrEmailSendFailed, {
              status: String(res.status),
            })
        );
      }
    },
    [t]
  );
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
  const [historyEntries, setHistoryEntries] = useState<CgBatchHistoryEntry[]>(
    []
  );
  const [dismissedSaveTipKey, setDismissedSaveTipKey] = useState<string | null>(
    null
  );

  useEffect(() => {
    setHistoryEntries(loadCgBatchHistory());
  }, []);

  const historyLocaleTag = useMemo(() => {
    if (locale === "zh-TW") return "zh-TW";
    if (locale === "zh-CN") return "zh-CN";
    if (locale === "ja") return "ja-JP";
    if (locale === "ko") return "ko-KR";
    return "en-US";
  }, [locale]);

  const formatHistoryAt = useCallback(
    (iso: string) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString(historyLocaleTag, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    [historyLocaleTag]
  );

  const recentThree = useMemo(
    () => historyEntries.slice(0, 3),
    [historyEntries]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const next = acceptedFiles.filter(isPdfFileLike);
      if (acceptedFiles.length > 0 && next.length === 0) {
        setError(t.protectPdfErrNoValidPdfsDropped);
      } else if (next.length < acceptedFiles.length) {
        setError(t.protectPdfErrSomeSkipped);
      } else if (next.length > 0) {
        setError(null);
      }
      setPdfFiles((prev) => [...prev, ...next]);
    },
    [t]
  );

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

  const emailsIdentityKey = useMemo(
    () =>
      [...parsedEmails].map((e) => e.toLowerCase()).sort().join("|"),
    [parsedEmails]
  );

  const matchesSavedGroup = useMemo(() => {
    if (parsedEmails.length === 0) return false;
    return Object.values(groups).some((g) =>
      emailListsMatch(parsedEmails, g)
    );
  }, [parsedEmails, groups]);

  const suggestedLabel = useMemo(
    () => suggestGroupLabelFromRaw(emailListText),
    [emailListText]
  );

  const showSaveNewListTip =
    parsedEmails.length > 0 &&
    !matchesSavedGroup &&
    dismissedSaveTipKey !== emailsIdentityKey &&
    !loading;

  const applyHistoryEntry = useCallback((entry: CgBatchHistoryEntry) => {
    setEmailListText(entry.emails.join("\n"));
    setSelectedGroupName(null);
    setSelectValue("");
    setError(null);
  }, []);

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
      setError(t.protectPdfErrGroupName);
      return;
    }
    if (emails.length === 0) {
      setError(t.protectPdfErrPasteEmails);
      return;
    }
    upsertGroup(name, emails);
    setSelectedGroupName(name);
    setSelectValue(name);
    setNewGroupName("");
    setDismissedSaveTipKey(
      [...emails].map((e) => e.toLowerCase()).sort().join("|")
    );
    setError(null);
  }, [emailListText, newGroupName, upsertGroup, t]);

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
      setError(t.protectPdfErrNeedPdf);
      return;
    }
    if (emails.length === 0) {
      setError(t.protectPdfErrNeedEmail);
      return;
    }

    const invalid = pdfFiles.filter((f) => !isPdfFileLike(f));
    if (invalid.length > 0) {
      setError(
        tpl(t.protectPdfErrPdfInvalid, {
          names: invalid.map((f) => f.name).join(", "),
        })
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
        tpl(t.protectPdfErrTooManyCombos, {
          total: String(tasks.length),
          max: String(PDF_CLIENT_MAX_COMBOS),
        })
      );
      return;
    }

    setHistoryEntries(appendCgBatchHistory(emails));

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
          throw new Error(
            j?.message ??
              tpl(t.protectPdfErrRequestFailed, { status: String(res.status) })
          );
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
              tpl(t.protectPdfErrFailedOn, {
                file: file.name,
                email,
                status: String(res.status),
              })
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
      setError(
        err instanceof Error ? err.message : t.protectPdfErrGeneric
      );
    } finally {
      setLoading(false);
    }
  }, [
    emailListText,
    pdfFiles,
    sendEmailAfterProtection,
    sendProtectedPdfEmail,
    t,
  ]);

  return (
    <main className="min-h-screen px-4 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <Link
              href="/"
              className="text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
            >
              {t.protectPdfBackHome}
            </Link>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {t.protectPdfTitle}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              {t.protectPdfIntro}
            </p>
          </div>
          <div className="shrink-0 sm:pt-1">
            <LanguageSelector />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-10">
          {/* Left ~40% */}
          <section className="flex flex-col gap-4 lg:col-span-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t.protectPdfSectionFiles}
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
                  ? t.protectPdfDropActive
                  : t.protectPdfDropIdle}
              </p>
              <p className="mt-2 text-center text-xs text-slate-500">
                {t.protectPdfDropHint}
              </p>
            </div>

            <div className="space-y-2">
              {pdfFiles.length === 0 ? (
                <p className="rounded-xl border border-slate-800/80 bg-slate-950/30 px-4 py-6 text-center text-sm text-slate-500">
                  {t.protectPdfNoFilesYet}
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
              {t.protectPdfSectionContact}
            </h2>

            {(loading && progress) || batchSendLog.length > 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">
                {loading && progress ? (
                  <>
                    <p className="mb-1 text-center text-xs font-medium text-slate-500">
                      {t.protectPdfBatchRunning}
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
                    {t.protectPdfLastBatch}
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
                            title={t.protectPdfEmailSentTitle}
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
                    {t.protectPdfSelectGroup}
                  </label>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t.protectPdfSavedInPrefix}{" "}
                    <code className="text-slate-600">cg_email_groups</code>
                    {!hydrated ? ` · ${t.protectPdfLoadingSuffix}` : null}
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
                    <option value="">{t.protectPdfPickGroupPlaceholder}</option>
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
                    {t.protectPdfQuickBadges}
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
                            title={t.protectPdfRemoveGroup}
                            aria-label={tpl(t.protectPdfRemoveGroupAria, {
                              name,
                            })}
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
                  {t.protectPdfNoGroupsHint}{" "}
                  <strong className="text-slate-400">
                    {t.protectPdfNoGroupsBold}
                  </strong>
                  .
                </p>
              ) : null}
            </div>

            <div className="relative flex flex-col gap-2">
              {recentThree.length > 0 ? (
                <div className="mb-1">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                    {t.protectPdfRecentlyUsed}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recentThree.map((h, idx) => (
                      <button
                        key={`${h.at}-${idx}`}
                        type="button"
                        disabled={loading}
                        onClick={() => applyHistoryEntry(h)}
                        className="rounded-full border border-violet-500/35 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100 transition hover:bg-violet-500/20 disabled:opacity-45"
                        title={h.emails.join(", ")}
                      >
                        {h.emails.length} · {formatHistoryAt(h.at)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <label
                htmlFor="email-list"
                className="text-sm font-medium text-slate-300"
              >
                {t.protectPdfEmailsLabel}
              </label>
              <textarea
                id="email-list"
                value={emailListText}
                onChange={(e) => onEmailTextChange(e.target.value)}
                rows={7}
                disabled={loading}
                placeholder={t.protectPdfEmailsPlaceholder}
                className="min-h-[10rem] w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
              />
              {suggestedLabel && !newGroupName.trim() ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setNewGroupName(suggestedLabel)}
                    className="rounded-lg border border-cyan-500/35 bg-cyan-950/50 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-900/55 disabled:opacity-45"
                  >
                    {tpl(t.protectPdfUseSuggestedName, {
                      name: suggestedLabel,
                    })}
                  </button>
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <input
                  id="protect-new-group-name"
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  disabled={loading}
                  placeholder={t.protectPdfNewGroupPlaceholder}
                  className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
                  aria-label={t.protectPdfNewGroupAria}
                />
                <button
                  type="button"
                  onClick={saveAsGroup}
                  disabled={loading}
                  className="shrink-0 rounded-xl border border-emerald-600/50 bg-emerald-950/40 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-900/50 disabled:opacity-50"
                >
                  {t.protectPdfSaveAsGroup}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                {parsedEmails.length === 0
                  ? tpl(t.protectPdfManyValidEmails, {
                      count: "0",
                    })
                  : parsedEmails.length === 1
                    ? t.protectPdfOneValidEmail
                    : tpl(t.protectPdfManyValidEmails, {
                        count: String(parsedEmails.length),
                      })}
                {comboCount > 0
                  ? ` · ${
                      comboCount === 1
                        ? t.protectPdfOneOutput
                        : tpl(t.protectPdfManyOutputs, {
                            count: String(comboCount),
                          })
                    }`
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
                  {t.protectPdfSendEmailCheckbox}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {t.protectPdfSendEmailHint}
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
                  ? tpl(t.protectPdfProtectingWithCount, {
                      done: String(progress.done),
                      total: String(progress.total),
                    })
                  : t.protectPdfProtecting
                : t.protectPdfStartBatch}
            </button>

            <p className="text-[11px] leading-relaxed text-slate-600">
              {tpl(t.protectPdfFooterBatch, {
                max: String(PDF_BATCH_MAX_COMBOS),
              })}
            </p>

            {showSaveNewListTip ? (
              <div
                className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4 sm:inset-x-auto sm:bottom-6 sm:right-5 sm:justify-end"
                role="status"
              >
                <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-amber-500/35 bg-slate-950/95 px-4 py-3 text-sm text-amber-50 shadow-2xl shadow-black/50 backdrop-blur-md ring-1 ring-amber-500/20">
                  <p className="min-w-0 flex-1 leading-snug text-amber-100/95">
                    {t.protectPdfSaveNewListTip}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById("protect-new-group-name")?.focus();
                    }}
                    className="shrink-0 rounded-lg bg-amber-500/90 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
                  >
                    {t.protectPdfSaveNewListCta}
                  </button>
                  <button
                    type="button"
                    aria-label={t.protectPdfSaveNewListDismissAria}
                    onClick={() =>
                      setDismissedSaveTipKey(emailsIdentityKey)
                    }
                    className="shrink-0 rounded-lg p-1.5 text-amber-200/80 transition hover:bg-amber-950/50 hover:text-amber-50"
                  >
                    ×
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
