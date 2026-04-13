"use client";

import { isValidMemberIdentityToken } from "@/lib/member-identity";
import { useLanguage } from "@/lib/i18n/language-context";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";

function isImageFileLike(f: File): boolean {
  if (f.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|avif|heic)$/i.test(f.name);
}

export default function ProtectImageClient() {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [watermarkText, setWatermarkText] = useState("");
  const [overlayOpacity, setOverlayOpacity] = useState(42);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capacityHint, setCapacityHint] = useState<string | null>(null);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onDrop = useCallback(
    (accepted: File[]) => {
      const next = accepted.find(isImageFileLike);
      if (!next) {
        setError(t.protectPdfErrSomeSkipped);
        return;
      }
      setFile(next);
      setError(null);
    },
    [t.protectPdfErrSomeSkipped]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/gif": [".gif"],
      "image/avif": [".avif"],
      "image/heic": [".heic"],
    },
    multiple: false,
    disabled: loading,
  });

  const overlayLabel =
    watermarkText.trim() || t.protectImageWatermarkPlaceholder;

  const downloadProtected = useCallback(async () => {
    setError(null);
    setCapacityHint(null);
    const text = watermarkText.trim();
    if (!file) {
      setError(t.quickTestNeedImage);
      return;
    }
    if (!text) {
      setError(t.quickTestNeedMember);
      return;
    }
    if (!isValidMemberIdentityToken(text)) {
      setError(t.quickTestInvalidMemberId);
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("memberId", text);
      fd.set("userId", text);

      const res = await fetch("/api/protect", {
        method: "POST",
        body: fd,
        signal: AbortSignal.timeout(180_000),
      });
      const ct = (res.headers.get("content-type") ?? "").toLowerCase();

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          code?: string;
          message?: string;
          error?: string;
        };
        if (data.code === "capacity" || res.status === 422) {
          setCapacityHint(t.toastCapacityHint);
          throw new Error(
            data.message || "Not enough space to embed this ID."
          );
        }
        throw new Error(
          data.message || data.error || `Request failed (${res.status})`
        );
      }

      if (
        !ct.includes("png") &&
        !ct.includes("jpeg") &&
        !ct.includes("jpg") &&
        !ct.includes("octet-stream")
      ) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(data.message || "Unexpected response from server.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe =
        text.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "watermark";
      const ext =
        ct.includes("png")
          ? "png"
          : ct.includes("jpeg") || ct.includes("jpg")
            ? "jpg"
            : "bin";
      a.download = `creator-guard-${safe}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [file, watermarkText, t]);

  return (
    <main className="min-h-screen px-4 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {t.protectImageTitle}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          {t.protectImageIntro}
        </p>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-10">
          <section className="flex flex-col gap-4 lg:col-span-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t.protectImageSectionPreview}
            </h2>
            <div
              {...getRootProps()}
              className={`flex min-h-[8rem] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-6 transition ${
                isDragActive
                  ? "border-sky-400/70 bg-sky-500/10"
                  : "border-slate-600/70 bg-slate-900/40 hover:border-slate-500"
              } ${loading ? "pointer-events-none opacity-50" : ""}`}
            >
              <input {...getInputProps()} />
              <p className="text-center text-sm font-medium text-slate-200">
                {isDragActive ? t.protectPdfDropActive : t.quickTestImageButton}
              </p>
              <p className="mt-1 text-center text-xs text-slate-500">
                {t.quickTestHint}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950/60">
              {previewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt=""
                    className="max-h-[24rem] w-full object-contain"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                    <span
                      className="max-w-full break-words text-center text-xl font-bold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] sm:text-2xl"
                      style={{ opacity: Math.max(0.08, overlayOpacity / 100) }}
                    >
                      {overlayLabel}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[14rem] items-center justify-center px-4 text-center text-xs text-slate-600">
                  {t.protectPdfNoFilesYet}
                </div>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600">
              {t.protectImageDctHint}
            </p>
          </section>

          <section className="flex flex-col gap-5 lg:col-span-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t.protectImageOptionsTitle}
            </h2>

            <div>
              <label
                htmlFor="watermark-text"
                className="text-sm font-medium text-slate-300"
              >
                {t.protectImageWatermarkLabel}
              </label>
              <input
                id="watermark-text"
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                disabled={loading}
                placeholder={t.quickTestMemberPlaceholder}
                autoComplete="off"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-60"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="overlay-opacity"
                  className="text-sm font-medium text-slate-300"
                >
                  {t.protectImageTransparencyLabel}
                </label>
                <span className="tabular-nums text-xs text-slate-500">
                  {overlayOpacity}%
                </span>
              </div>
              <input
                id="overlay-opacity"
                type="range"
                min={5}
                max={100}
                value={overlayOpacity}
                onChange={(e) =>
                  setOverlayOpacity(Number.parseInt(e.target.value, 10))
                }
                disabled={loading || !previewUrl}
                className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-sky-500 disabled:opacity-40"
              />
              <p className="mt-1 text-xs text-slate-600">
                {t.protectImageTransparencyHint}
              </p>
            </div>

            {file ? (
              <p className="truncate text-xs text-slate-500" title={file.name}>
                {file.name} · {(file.size / 1024).toFixed(1)} KB
              </p>
            ) : null}

            {capacityHint ? (
              <p className="text-xs text-amber-200/90">{capacityHint}</p>
            ) : null}
            {error ? (
              <p className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void downloadProtected()}
              disabled={loading || !file}
              className="rounded-xl bg-sky-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden
                  />
                  {t.quickTestProcessingWait}
                </span>
              ) : (
                t.protectImageDownloadProtected
              )}
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
