"use client";

import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/lib/i18n/language-context";
import Link from "next/link";
import { useCallback, useState } from "react";

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

export default function VerifyPdfPage() {
  const { t } = useLanguage();
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanJson | null>(null);

  const scan = useCallback(async () => {
    setError(null);
    setResult(null);
    if (!file) {
      setError(t.verifyPdfNeedFile);
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/verify/pdf", { method: "POST", body: fd });
      const data = (await res.json()) as ScanJson & { message?: string; error?: string };
      if (!res.ok) {
        throw new Error(
          typeof data.message === "string" ? data.message : `Error ${res.status}`
        );
      }
      if (data.status === "found" || data.status === "not_found") {
        setResult(data as ScanJson);
      } else {
        throw new Error("Unexpected response");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.verifyPdfScanFailed);
    } finally {
      setLoading(false);
    }
  }, [file, t.verifyPdfNeedFile, t.verifyPdfScanFailed]);

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
          >
            {t.verifyBackHome}
          </Link>
          <LanguageSelector />
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
              document.getElementById("verify-pdf-input")?.click();
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
            if (f && (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))) {
              setFile(f);
              setResult(null);
              setError(null);
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
            id="verify-pdf-input"
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setResult(null);
                setError(null);
              }
            }}
          />
          <button
            type="button"
            onClick={() => document.getElementById("verify-pdf-input")?.click()}
            className="text-slate-200"
          >
            {file ? file.name : t.verifyPdfDropTitle}
          </button>
          <p className="mt-2 text-xs text-slate-500">{t.verifyPdfMaxSize}</p>
        </div>

        <button
          type="button"
          disabled={loading || !file}
          onClick={scan}
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

        {error ? (
          <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            {error}
          </p>
        ) : null}

        {result?.status === "found" ? (
          <div
            className="mt-8 rounded-xl border-2 border-red-600 bg-red-950/50 p-5 text-red-50 shadow-lg shadow-red-950/40"
            style={{ borderColor: "rgb(220 38 38)" }}
          >
            <p className="text-lg font-bold tracking-wide text-red-200">
              {t.verifyPdfGhostDetected}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-red-300/90">{t.verifyPdfBuyerEmail}</dt>
                <dd className="font-mono text-red-50">{result.buyerEmail}</dd>
              </div>
              <div>
                <dt className="text-red-300/90">{t.verifyPdfMemberId}</dt>
                <dd className="font-mono text-red-50">{result.userId}</dd>
              </div>
              <div>
                <dt className="text-red-300/90">{t.verifyPdfTimestamp}</dt>
                <dd className="font-mono text-red-50">{result.timestamp || "—"}</dd>
              </div>
              <div>
                <dt className="text-red-300/90">{t.verifyPdfVersion}</dt>
                <dd className="font-mono text-red-50">{result.version}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        {result?.status === "not_found" ? (
          <div className="mt-8 rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-4 text-slate-300">
            <p className="font-medium text-slate-200">{t.verifyPdfCleanDoc}</p>
            <p className="mt-1 text-xs text-slate-500">{result.message}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
