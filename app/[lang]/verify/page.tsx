"use client";

import {
  UniversalVerifyRadar,
  type UniversalRadarOutcome,
  type UniversalVerifyKind,
} from "@/components/verify/UniversalVerifyRadar";
import { PDF_PROTECT_MAX_BYTES } from "@/lib/pdf-protect-shared";
import { useLanguage } from "@/lib/i18n/language-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function tpl(s: string, vars: Record<string, string>): string {
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}

const VERIFY_PDF_FETCH_TIMEOUT_MS = 900_000;
const PDF_MAX_MB = PDF_PROTECT_MAX_BYTES / (1024 * 1024);

function detectKind(file: File): UniversalVerifyKind {
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.startsWith("video/")) return "video";
  return "unknown";
}

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

type PdfScanJson =
  | {
      status: "found";
      buyerEmail: string;
      userId: string;
      timestamp?: string;
      version?: string;
    }
  | { status: "not_found"; message: string };

export default function VerifyPage() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<UniversalVerifyKind>("unknown");
  const [mimeLabel, setMimeLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [radarOutcome, setRadarOutcome] =
    useState<UniversalRadarOutcome>("pending");
  const [imageUserId, setImageUserId] = useState<string | null>(null);
  const [imageCleanDetail, setImageCleanDetail] = useState<string | null>(null);
  const [pdfResult, setPdfResult] = useState<PdfScanJson | null>(null);
  const [videoNotice, setVideoNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDebug, setErrorDebug] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<
    string,
    unknown
  > | null>(null);

  const previewUrl = useMemo(() => {
    if (!file || kind !== "image") return null;
    return URL.createObjectURL(file);
  }, [file, kind]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const applyFile = useCallback((f: File) => {
    setFile(f);
    setKind(detectKind(f));
    setMimeLabel(f.type || "application/octet-stream");
    setImageUserId(null);
    setImageCleanDetail(null);
    setPdfResult(null);
    setVideoNotice(false);
    setError(null);
    setErrorDebug(null);
    setVerifyResult(null);
    setRadarOutcome("pending");
  }, []);

  const handleVerify = useCallback(async () => {
    if (!file) return;
    const k = detectKind(file);
    if (k === "unknown") {
      setError(t.verifyUniversalUnsupported);
      return;
    }

    setLoading(true);
    setError(null);
    setErrorDebug(null);
    setVerifyResult(null);
    setImageUserId(null);
    setImageCleanDetail(null);
    setPdfResult(null);
    setVideoNotice(false);
    setRadarOutcome("pending");

    try {
      if (k === "video") {
        await new Promise((r) => setTimeout(r, 1100));
        setRadarOutcome("video_preview");
        setVideoNotice(true);
        return;
      }

      if (k === "pdf") {
        if (file.size > PDF_PROTECT_MAX_BYTES) {
          throw new Error(
            tpl(t.verifyPdfFileTooLarge, { maxMb: String(PDF_MAX_MB) })
          );
        }
        const ab = await file.arrayBuffer();
        const fd = new FormData();
        fd.set(
          "file",
          new File([ab], file.name, {
            type: file.type || "application/pdf",
          })
        );
        const res = await fetch("/api/verify/pdf", {
          method: "POST",
          body: fd,
          signal: AbortSignal.timeout(VERIFY_PDF_FETCH_TIMEOUT_MS),
        });
        const data = (await res.json()) as PdfScanJson & {
          message?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(
            typeof data.message === "string"
              ? data.message
              : `Error ${res.status}`
          );
        }
        if (data.status === "found") {
          setPdfResult(data as PdfScanJson);
          setRadarOutcome("pdf_found");
        } else if (data.status === "not_found") {
          setPdfResult(data as PdfScanJson);
          setRadarOutcome("pdf_clean");
        } else {
          throw new Error("Unexpected response");
        }
        return;
      }

      const bytes = await file.arrayBuffer();
      await drawArrayBufferToHiddenCanvas(
        bytes,
        file.type,
        hiddenCanvasRef.current
      );

      const formData = new FormData();
      formData.set(
        "file",
        new File([bytes], file.name, {
          type: file.type || "application/octet-stream",
        })
      );

      const res = await fetch(
        `/api/verify?t=${Date.now()}&r=${Math.random().toString(36).slice(2, 10)}`,
        { method: "POST", body: formData }
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
        setImageUserId(data.userId);
        setRadarOutcome("image_found");
        return;
      }

      if (httpStatus === 422 && data.FULL_OFFSETS != null) {
        setRadarOutcome("pending");
        const msg =
          typeof data.message === "string"
            ? data.message
            : typeof data.code === "string"
              ? `FAIL: ${data.code}`
              : t.verifyUploadError;
        setError(msg);
        setErrorDebug(JSON.stringify(data.FULL_OFFSETS, null, 2));
        return;
      }

      const msg =
        typeof data.message === "string"
          ? data.message
          : typeof data.code === "string"
            ? `FAIL: ${data.code}`
            : t.verifyNoWatermark;
      setImageCleanDetail(msg);
      setRadarOutcome("image_clean");
    } catch (e) {
      setRadarOutcome("pending");
      setError(e instanceof Error ? e.message : t.verifyUploadError);
      setErrorDebug(null);
      setVerifyResult({ error: "client_or_server_failed" });
    } finally {
      setLoading(false);
    }
  }, [file, t]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) applyFile(dropped);
    },
    [applyFile]
  );

  const scanActive = loading;
  const showRadar =
    scanActive ||
    radarOutcome === "image_found" ||
    radarOutcome === "image_clean" ||
    radarOutcome === "pdf_found" ||
    radarOutcome === "pdf_clean" ||
    radarOutcome === "video_preview";

  return (
    <div className="relative min-h-full bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      <canvas
        ref={hiddenCanvasRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
        width={1}
        height={1}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.1),transparent)]" />

      <div className="relative mx-auto max-w-lg px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
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
            {t.verifyUniversalPageSubtitle}
          </p>
        </header>

        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf,.pdf,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) applyFile(f);
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
            {t.verifyUniversalDropTitle}
          </span>
          <span className="mt-2 text-center text-xs text-slate-500">
            {t.verifyUniversalDropHint}
          </span>
          {file ? (
            <>
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt=""
                  className="mt-4 max-h-28 max-w-full rounded-lg border border-white/10 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : kind === "pdf" ? (
                <div className="mt-4 flex h-24 w-20 items-center justify-center rounded-lg border border-red-500/30 bg-red-950/40 text-[10px] font-bold uppercase text-red-300">
                  PDF
                </div>
              ) : kind === "video" ? (
                <div className="mt-4 flex h-24 w-36 items-center justify-center rounded-lg border border-fuchsia-500/30 bg-fuchsia-950/30 text-xs font-medium text-fuchsia-200/90">
                  Video
                </div>
              ) : null}
              <span className="mt-2 truncate px-4 text-[11px] text-cyan-500/80">
                {file.name}
              </span>
              <span className="mt-0.5 text-[10px] text-slate-600">
                {mimeLabel}
              </span>
            </>
          ) : null}
        </button>

        <div className="mt-5 flex w-full items-center gap-3">
          <button
            type="button"
            disabled={loading || !file || kind === "unknown"}
            onClick={() => void handleVerify()}
            className="flex h-12 min-w-0 flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-500 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-900/20 transition hover:brightness-105 disabled:opacity-50"
          >
            {loading ? t.verifyAnalyzing : t.verifyButton}
          </button>
        </div>

        {showRadar ? (
          <UniversalVerifyRadar
            active={scanActive}
            kind={kind}
            mime={mimeLabel}
            outcome={radarOutcome}
            t={t}
          />
        ) : null}

        {videoNotice ? (
          <p className="mt-4 rounded-2xl border border-fuchsia-500/25 bg-fuchsia-950/25 px-4 py-3 text-center text-sm text-fuchsia-100/90">
            {t.verifyUniversalVideoSoon}
          </p>
        ) : null}

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

        {radarOutcome === "image_clean" && imageCleanDetail ? (
          <p className="mt-4 text-center text-xs text-slate-500">
            {imageCleanDetail}
          </p>
        ) : null}

        {pdfResult?.status === "found" ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-950/25 p-5 text-center">
            <p className="text-sm text-emerald-100/95">
              {t.verifyUniversalPdfFoundHint}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-500/80">
              {t.verifyPdfMemberIdentity}
            </p>
            <p className="mt-2 break-all font-mono text-lg font-semibold text-emerald-200">
              {pdfResult.buyerEmail}
            </p>
            <p className="mt-1 break-all font-mono text-sm text-emerald-400/80">
              {pdfResult.userId}
            </p>
            <button
              type="button"
              onClick={() => {
                void router.push(`/${locale}/verify/pdf`);
              }}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-500/35 transition hover:bg-cyan-500/25"
            >
              {t.verifyUniversalFullForensicLink}
            </button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
              {t.verifyUniversalForensicNote}
            </p>
          </div>
        ) : null}

        {pdfResult?.status === "not_found" ? (
          <div className="mt-6 rounded-2xl border border-slate-600/50 bg-slate-900/50 p-5 text-center">
            <p className="text-sm text-slate-300">
              {t.verifyUniversalPdfCleanHint}
            </p>
            <p className="mt-2 text-xs text-slate-500">{pdfResult.message}</p>
            <button
              type="button"
              onClick={() => {
                void router.push(`/${locale}/verify/pdf`);
              }}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-500/35 transition hover:bg-cyan-500/25"
            >
              {t.verifyUniversalFullForensicLink}
            </button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
              {t.verifyUniversalForensicNote}
            </p>
          </div>
        ) : null}

        {verifyResult && kind === "image" ? (
          <div className="mt-4 rounded-2xl border-2 border-lime-500/50 bg-black/80 px-3 py-3">
            <p className="mb-2 text-left text-[11px] font-semibold uppercase tracking-wide text-lime-300">
              Full API payload (code, debug, raw_hex, nested bitShiftHex0to7.offset_*_hex)
            </p>
            <pre className="max-h-[min(80vh,40rem)] min-h-[16rem] w-full overflow-auto whitespace-pre-wrap break-all rounded-lg border border-lime-500/30 bg-slate-950 p-4 text-left font-mono text-sm leading-relaxed text-lime-100">
              {JSON.stringify(verifyResult, null, 2)}
            </pre>
          </div>
        ) : null}

        {imageUserId ? (
          <div className="mt-8 rounded-[1.35rem] border border-emerald-500/20 bg-emerald-950/25 p-6 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70">
              {t.verifyMemberLabel}
            </p>
            <p className="mt-2 break-all font-mono text-xl font-semibold text-emerald-100">
              {imageUserId}
            </p>
          </div>
        ) : null}

        <footer className="mt-14 text-center">
          <Link
            href={`/${locale}`}
            className="text-sm text-cyan-400/75 transition hover:text-cyan-300"
          >
            {t.verifyBackHome}
          </Link>
        </footer>
      </div>
    </div>
  );
}
