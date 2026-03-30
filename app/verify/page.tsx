"use client";

import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/lib/i18n/language-context";
import type { Messages } from "@/lib/i18n/types";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

function mapVerifyFailureCode(code: string | undefined, tr: Messages): string {
  switch (code) {
    case "magic_missing":
      return tr.verifyErrMagicMissing;
    case "unsupported_version":
      return tr.verifyErrUnsupportedVersion;
    case "length_invalid":
      return tr.verifyErrLengthInvalid;
    case "payload_truncated":
      return tr.verifyErrPayloadTruncated;
    case "utf8_corrupt":
      return tr.verifyErrUtf8Corrupt;
    case "capacity":
      return tr.verifyErrCapacity;
    case "decode_failed":
      return tr.verifyErrDecodeFailed;
    default:
      return tr.verifyNoWatermark;
  }
}

export default function VerifyPage() {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDebug, setErrorDebug] = useState<string | null>(null);

  const analyze = useCallback(
    async (f: File) => {
      setFile(f);
      setUserId(null);
      setError(null);
      setErrorDebug(null);
      setLoading(true);
      try {
        const fd = new FormData();
        fd.set("file", f);
        const res = await fetch("/api/verify", { method: "POST", body: fd });
        const data = (await res.json()) as {
          ok?: boolean;
          userId?: string;
          message?: string;
          code?: string;
        };
        if (data.ok && data.userId) setUserId(data.userId);
        else {
          const code = data.code;
          setError(
            code ? mapVerifyFailureCode(code, t) : data.message ?? t.verifyNoWatermark
          );
          if (code && data.message) {
            setErrorDebug(`code: ${code}\n${data.message}`);
          } else if (code) {
            setErrorDebug(`code: ${code}`);
          } else if (data.message) {
            setErrorDebug(data.message);
          }
        }
      } catch {
        setError(t.verifyUploadError);
        setErrorDebug(null);
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith("image/")) void analyze(f);
    },
    [analyze]
  );

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.1),transparent)]" />

      <div className="relative mx-auto max-w-lg px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <div className="mb-8 flex justify-end">
          <LanguageSelector />
        </div>

        <header className="mb-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-400/85">
            {t.brandName}
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {t.verifyPageTitle}
          </h1>
          <p className="mx-auto mt-3 inline-flex max-w-md items-center justify-center rounded-full border border-cyan-500/25 bg-cyan-500/[0.07] px-3 py-1 text-[11px] font-medium tracking-wide text-cyan-300/90">
            {t.highResistProtectionBadge}
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
            {t.verifyPageSubtitle}
          </p>
        </header>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void analyze(f);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          disabled={loading}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex w-full flex-col items-center justify-center rounded-[1.35rem] border-2 border-dashed px-4 py-14 transition-all duration-200 disabled:opacity-60 ${
            dragOver
              ? "border-cyan-400/55 bg-cyan-500/10"
              : "border-white/[0.12] bg-slate-900/60 hover:border-white/20 hover:bg-white/[0.03]"
          }`}
        >
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] text-cyan-400/90">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M12 4v12M6 10l6-6 6 6" />
              <path d="M4 20h16" />
            </svg>
          </div>
          <span className="text-base font-medium text-slate-100">
            {t.verifyDropTitle}
          </span>
          <span className="mt-2 text-center text-xs text-slate-500">
            {t.verifyDropHint}
          </span>
          {file ? (
            <span className="mt-4 truncate px-4 text-[11px] text-cyan-500/80">
              {file.name}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          disabled={!file || loading}
          onClick={() => file && void analyze(file)}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-500 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-900/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? t.verifyAnalyzing : t.verifyButton}
        </button>

        {error ? (
          <div className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-950/30 px-4 py-3 text-center text-sm text-amber-200/90">
            <p>{error}</p>
            {errorDebug ? (
              <pre className="mt-3 whitespace-pre-wrap break-all text-left font-mono text-[10px] leading-relaxed text-amber-200/50">
                {errorDebug}
              </pre>
            ) : null}
          </div>
        ) : null}

        {userId ? (
          <div className="mt-8 rounded-[1.35rem] border border-emerald-500/20 bg-emerald-950/25 p-6 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70">
              {t.verifyMemberLabel}
            </p>
            <p className="mt-2 break-all font-mono text-xl font-semibold text-emerald-100">
              {userId}
            </p>
          </div>
        ) : null}

        <footer className="mt-14 text-center">
          <Link
            href="/"
            className="text-sm text-cyan-400/75 transition hover:text-cyan-300"
          >
            {t.verifyBackHome}
          </Link>
        </footer>
      </div>
    </div>
  );
}
