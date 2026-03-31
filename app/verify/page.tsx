"use client";

import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/lib/i18n/language-context";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Decode the same bytes the server will receive: hidden canvas at intrinsic size, black
 * backing (matches server flatten), integer geometry — no toBlob / PNG re-encode.
 */
function drawArrayBufferToHiddenCanvas(
  ab: ArrayBuffer,
  mime: string,
  canvas: HTMLCanvasElement | null
): Promise<void> {
  if (!canvas) return Promise.resolve();
  const blob = new Blob([ab], {
    type: mime || "application/octet-stream",
  });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = Math.floor(img.naturalWidth);
        const h = Math.floor(img.naturalHeight);
        if (w < 1 || h < 1) return;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { alpha: true });
        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.translate(Math.floor(0), Math.floor(0));
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(
          img,
          Math.floor(0),
          Math.floor(0),
          Math.floor(w),
          Math.floor(h),
          Math.floor(0),
          Math.floor(0),
          Math.floor(w),
          Math.floor(h)
        );
      } finally {
        URL.revokeObjectURL(url);
        resolve();
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    img.src = url;
  });
}

export default function VerifyPage() {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDebug, setErrorDebug] = useState<string | null>(null);
  /** Last /api/verify JSON body (or client error stub). */
  const [verifyResult, setVerifyResult] = useState<Record<string, unknown> | null>(
    null
  );

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleVerify = useCallback(
    async (uploadedFile: File) => {
      setFile(uploadedFile);
      setUserId(null);
      setError(null);
      setErrorDebug(null);
      setVerifyResult(null);
      setLoading(true);

      try {
        const bytes = await uploadedFile.arrayBuffer();
        await drawArrayBufferToHiddenCanvas(
          bytes,
          uploadedFile.type,
          hiddenCanvasRef.current
        );

        const formData = new FormData();
        formData.set(
          "file",
          new File([bytes], uploadedFile.name, {
            type: uploadedFile.type || "application/octet-stream",
          })
        );

        const res = await fetch(
          `/api/verify?t=${Date.now()}&r=${Math.random().toString(36).slice(2, 10)}`,
          {
            method: "POST",
            body: formData,
          }
        );
        const httpStatus = res.status;
        let data: Record<string, unknown>;
        try {
          data = (await res.json()) as Record<string, unknown>;
        } catch {
          setError(t.verifyUploadError);
          setErrorDebug(`HTTP ${httpStatus} — invalid JSON`);
          return;
        }

        setVerifyResult(data);

        if (data.ok === true && typeof data.userId === "string") {
          setUserId(data.userId);
          return;
        }

        const msg =
          typeof data.message === "string"
            ? data.message
            : typeof data.code === "string"
              ? `FAIL: ${data.code}`
              : t.verifyUploadError;
        setError(msg);
        if (httpStatus === 422 && data.FULL_OFFSETS != null) {
          setErrorDebug(JSON.stringify(data.FULL_OFFSETS, null, 2));
        }
      } catch {
        setError(t.verifyUploadError);
        setErrorDebug(null);
        setVerifyResult({ error: "client_fetch_failed" });
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
      const dropped = e.dataTransfer.files[0];
      if (dropped && dropped.type.startsWith("image/")) void handleVerify(dropped);
    },
    [handleVerify]
  );

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      <canvas
        ref={hiddenCanvasRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
        width={1}
        height={1}
      />
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
            if (f) void handleVerify(f);
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
            <>
              {/* Preview only; upload is raw ArrayBuffer / original file bytes (no canvas PNG). */}
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt=""
                  className="mt-4 max-h-28 max-w-full rounded-lg border border-white/10 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : null}
              <span className="mt-2 truncate px-4 text-[11px] text-cyan-500/80">
                {file.name}
              </span>
            </>
          ) : null}
        </button>

        <div className="mt-5 flex w-full items-center gap-3">
          <button
            type="button"
            disabled={loading || !file}
            onClick={() => {
              if (file) void handleVerify(file);
            }}
            className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-500 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-900/20 transition hover:brightness-105 disabled:opacity-50"
          >
            {loading ? t.verifyAnalyzing : t.verifyButton}
          </button>
        </div>

        {error !== null ? (
          <div className="mt-6 rounded-2xl border border-amber-500/25 bg-amber-950/30 px-4 py-4 text-center text-sm text-amber-200/90">
            <p className="font-medium">{error}</p>
            {errorDebug ? (
              <pre className="mt-2 whitespace-pre-wrap break-all text-left font-mono text-[10px] leading-relaxed text-amber-200/50">
                {errorDebug}
              </pre>
            ) : null}
          </div>
        ) : null}

        {verifyResult ? (
          <div className="mt-4 rounded-2xl border-2 border-lime-500/50 bg-black/80 px-3 py-3">
            <p className="mb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-lime-300">
              Full API payload (code, debug, raw_hex, nested bitShiftHex0to7.offset_*_hex)
            </p>
            <pre className="max-h-[min(80vh,40rem)] min-h-[16rem] w-full overflow-auto whitespace-pre-wrap break-all rounded-lg border border-lime-500/30 bg-slate-950 p-4 text-left font-mono text-sm leading-relaxed text-lime-100">
              {JSON.stringify(verifyResult, null, 2)}
            </pre>
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
