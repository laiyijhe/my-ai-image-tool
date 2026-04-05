"use client";

import { ForensicReportCard } from "@/components/verify-pdf/ForensicReportCard";
import { ScanningRadar } from "@/components/verify-pdf/ScanningRadar";
import { useLanguage } from "@/lib/i18n/language-context";
import { PDF_PROTECT_MAX_BYTES } from "@/lib/pdf-protect-shared";
import {
  makeForensicCaseId,
  pdfPageCountFromArrayBuffer,
  sha256HexOfArrayBuffer,
} from "@/lib/verify-pdf-forensic-meta";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

function tpl(s: string, vars: Record<string, string>): string {
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}

/** Full request (upload + server); API `maxDuration` is 180s — allow slow uplinks for 50MB. */
const VERIFY_PDF_FETCH_TIMEOUT_MS = 900_000;

const PDF_MAX_MB = PDF_PROTECT_MAX_BYTES / (1024 * 1024);

type ScanJson =
  | {
      status: "found";
      buyerEmail: string;
      userId: string;
      timestamp: string;
      version: string;
      author: string | null;
      producer: string | null;
    }
  | {
      status: "not_found";
      message: string;
      author: string | null;
      producer: string | null;
    };

type ForensicMeta = {
  sha256: string;
  pageCount: number;
};

/**
 * PDF fingerprint viewer only: upload → POST /api/verify/pdf → show metadata.
 * No programmatic PDF download or re-protection. Optional PNG export / print for the report UI.
 */
export default function VerifyPdfClient() {
  const { t, locale } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const scanInFlightRef = useRef(false);

  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanJson | null>(null);
  const [forensicMeta, setForensicMeta] = useState<ForensicMeta | null>(null);
  const [caseIdStamp, setCaseIdStamp] = useState("");
  const [pngBusy, setPngBusy] = useState(false);

  const fileTooLarge = useMemo(
    () => file !== null && file.size > PDF_PROTECT_MAX_BYTES,
    [file]
  );

  const scanOutcome =
    loading ? "pending"
    : result?.status === "found" ? "found"
    : result?.status === "not_found" ? "clean"
    : "pending";

  const scan = useCallback(async () => {
    if (scanInFlightRef.current) return;

    setError(null);
    setResult(null);
    setForensicMeta(null);
    setCaseIdStamp("");
    if (!file) {
      setError(t.verifyPdfNeedFile);
      return;
    }
    if (file.size > PDF_PROTECT_MAX_BYTES) {
      setError(
        tpl(t.verifyPdfFileTooLarge, { maxMb: String(PDF_MAX_MB) })
      );
      return;
    }

    scanInFlightRef.current = true;
    setLoading(true);
    try {
      const ab = await file.arrayBuffer();
      const uploadFile = new File([ab], file.name, {
        type: file.type || "application/pdf",
      });
      const fd = new FormData();
      fd.set("file", uploadFile);

      const [res, meta] = await Promise.all([
        fetch("/api/verify/pdf", {
          method: "POST",
          body: fd,
          signal: AbortSignal.timeout(VERIFY_PDF_FETCH_TIMEOUT_MS),
        }),
        (async (): Promise<ForensicMeta> => {
          try {
            const [sha256, pageCount] = await Promise.all([
              sha256HexOfArrayBuffer(ab),
              pdfPageCountFromArrayBuffer(ab),
            ]);
            return { sha256, pageCount };
          } catch {
            return { sha256: "", pageCount: 0 };
          }
        })(),
      ]);

      setForensicMeta(meta);

      const data = (await res.json()) as ScanJson & {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(
          typeof data.message === "string" ? data.message : `Error ${res.status}`
        );
      }
      if (data.status === "found" || data.status === "not_found") {
        setResult(data as ScanJson);
        if (data.status === "found") {
          setCaseIdStamp(makeForensicCaseId());
        }
      } else {
        throw new Error("Unexpected response");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.verifyPdfScanFailed);
      setForensicMeta(null);
    } finally {
      setLoading(false);
      scanInFlightRef.current = false;
    }
  }, [file, t]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const printReport = useCallback(() => {
    window.print();
  }, []);

  const downloadReportPng = useCallback(async () => {
    const el = reportRef.current;
    if (!el) return;
    setPngBusy(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#0f172a",
        logging: false,
        useCORS: true,
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `CreatorGuard-forensic-CG-${caseIdStamp || "report"}.png`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setPngBusy(false);
    }
  }, [caseIdStamp]);

  return (
    <div className="verify-pdf-page mx-auto max-w-2xl px-4 py-10">
      <div className="verify-pdf-no-print">
        <div className="mb-6">
          <Link
            href={`/${locale}/verify`}
            className="text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
          >
            {t.dashboardNavVerifyHub}
          </Link>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {t.verifyPdfPageTitle}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {t.verifyPdfPageSubtitle}
        </p>

        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openFilePicker();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (
              f &&
              (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))
            ) {
              setFile(f);
              setResult(null);
              setForensicMeta(null);
              setCaseIdStamp("");
              setError(
                f.size > PDF_PROTECT_MAX_BYTES
                  ? tpl(t.verifyPdfFileTooLarge, { maxMb: String(PDF_MAX_MB) })
                  : null
              );
            } else {
              setError(t.verifyPdfNeedFile);
            }
          }}
          className={`mt-8 cursor-pointer rounded-2xl border-2 border-dashed px-6 py-16 text-center transition ${
            dragOver
              ? "border-red-600 bg-red-950/25"
              : "border-slate-600 bg-slate-900/50 hover:border-slate-500"
          }`}
        >
          <input
            ref={fileInputRef}
            id="verify-pdf-input"
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setResult(null);
                setForensicMeta(null);
                setCaseIdStamp("");
                setError(
                  f.size > PDF_PROTECT_MAX_BYTES
                    ? tpl(t.verifyPdfFileTooLarge, { maxMb: String(PDF_MAX_MB) })
                    : null
                );
              }
            }}
          />
          <button
            type="button"
            onClick={openFilePicker}
            className="text-slate-200"
          >
            {file ? file.name : t.verifyPdfDropTitle}
          </button>
          <p className="mt-2 text-xs text-slate-500">{t.verifyPdfMaxSize}</p>
        </div>

        <button
          type="button"
          disabled={loading || !file || fileTooLarge}
          onClick={() => void scan()}
          className="relative mt-6 w-full overflow-hidden rounded-xl bg-rose-700 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden
              />
              {t.verifyPdfAnalyzing}
            </span>
          ) : (
            t.verifyPdfButton
          )}
        </button>
      </div>

      {loading || result?.status === "not_found" ? (
        <div className="verify-pdf-no-print">
          <ScanningRadar active={loading} outcome={scanOutcome} t={t} />
        </div>
      ) : null}

      {error ? (
        <p className="verify-pdf-no-print mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          {error}
        </p>
      ) : null}

      {result?.status === "found" &&
      file &&
      forensicMeta &&
      caseIdStamp ? (
        <>
          <ForensicReportCard
            ref={reportRef}
            caseId={caseIdStamp}
            originalFileName={file.name}
            fileSizeBytes={file.size}
            pageCount={forensicMeta.pageCount}
            sha256={forensicMeta.sha256 || "—"}
            buyerEmail={result.buyerEmail}
            fingerprintId={result.userId}
            embeddedTimestampRaw={result.timestamp}
            guardVersion={result.version}
          />
          <div className="verify-pdf-no-print mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={printReport}
              className="rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-700/90"
            >
              {t.verifyPdfPrintReport}
            </button>
            <button
              type="button"
              disabled={pngBusy}
              onClick={() => void downloadReportPng()}
              className="rounded-xl border border-red-700/50 bg-red-950/50 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:bg-red-900/50 disabled:opacity-50"
            >
              {pngBusy ? t.verifyPdfExportingPng : t.verifyPdfDownloadPng}
            </button>
          </div>
        </>
      ) : null}

      {result?.status === "not_found" ? (
        <div className="verify-pdf-no-print mt-6 rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-4 text-slate-300">
          <p className="font-medium text-slate-200">{t.verifyPdfCleanDoc}</p>
          <p className="mt-1 text-xs text-slate-500">{result.message}</p>
        </div>
      ) : null}
    </div>
  );
}
