"use client";

import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  CreatorGuardPdfError,
  protectPdfWithCreatorGuard,
} from "@/lib/pdf-guard";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

function tpl(s: string, vars: Record<string, string>): string {
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}

type Phase = "fetching" | "embedding" | "success" | "error";

function safeTemplatesPathname(pathname: string): string | null {
  const p = decodeURIComponent(pathname).replace(/\\/g, "/");
  if (!p.startsWith("/templates/")) return null;
  if (p.includes("..")) return null;
  return p;
}

/** Same-origin fetch path under `/templates/*`. */
function resolveTemplateFetchPath(
  fileUrl: string | null,
  fileId: string | null
): string {
  if (fileUrl?.trim()) {
    const raw = fileUrl.trim();
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const u = new URL(raw);
      if (u.origin !== window.location.origin) {
        throw new Error("invalid_file_url");
      }
      const path = safeTemplatesPathname(u.pathname);
      if (!path) throw new Error("invalid_file_url");
      return `${path}${u.search}`;
    }
    const qIdx = raw.indexOf("?");
    const head = qIdx === -1 ? raw : raw.slice(0, qIdx);
    const search = qIdx === -1 ? "" : raw.slice(qIdx);
    const pathOnly = head.startsWith("/") ? head : `/${head}`;
    const path = safeTemplatesPathname(pathOnly);
    if (!path) throw new Error("invalid_file_url");
    return `${path}${search}`;
  }
  if (fileId?.trim()) {
    const id = fileId.trim().replace(/[^a-zA-Z0-9._-]/g, "");
    if (!id) return "/templates/default.pdf";
    return `/templates/${id}.pdf`;
  }
  return "/templates/default.pdf";
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ClaimSuspenseFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <span
          className="h-10 w-10 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-400"
          aria-hidden
        />
        <p className="text-sm">Loading…</p>
      </div>
    </main>
  );
}

function ClaimContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const emailRaw = searchParams.get("email");
  const email = emailRaw ? decodeURIComponent(emailRaw.trim()) : "";
  const fileUrl = searchParams.get("fileUrl");
  const fileId = searchParams.get("fileId");

  const [phase, setPhase] = useState<Phase>(email ? "fetching" : "error");
  const [errorDetail, setErrorDetail] = useState<string | null>(() =>
    !email ? t.claimPageMissingEmail : null
  );
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [downloadFileName, setDownloadFileName] = useState(
    "creator-guard.pdf"
  );
  const [autoDownloadFailed, setAutoDownloadFailed] = useState(false);

  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!email) {
      setPhase("error");
      setErrorDetail(tRef.current.claimPageMissingEmail);
      return;
    }

    let fetchPath: string;
    try {
      fetchPath = resolveTemplateFetchPath(fileUrl, fileId);
    } catch {
      setPhase("error");
      setErrorDetail(tRef.current.claimPageError);
      return;
    }

    const ac = new AbortController();

    void (async () => {
      try {
        setPhase("fetching");
        setErrorDetail(null);
        setAutoDownloadFailed(false);
        setOutputBlob(null);

        const res = await fetch(fetchPath, { signal: ac.signal });
        if (!res.ok) throw new Error(`fetch_${res.status}`);

        const buf = await res.arrayBuffer();
        if (buf.byteLength < 5) throw new Error("empty_pdf");

        if (ac.signal.aborted) return;
        setPhase("embedding");

        const out = await protectPdfWithCreatorGuard(new Uint8Array(buf), {
          buyerEmail: email,
        });
        if (ac.signal.aborted) return;

        const copy = new Uint8Array(out.byteLength);
        copy.set(out);
        const blob = new Blob([copy], { type: "application/pdf" });
        const slug = email.replace(/[^\w@.-]+/g, "_").slice(0, 80);
        const name = `creator-guard-${slug}.pdf`;
        setOutputBlob(blob);
        setDownloadFileName(name);
        setPhase("success");

        try {
          triggerBrowserDownload(blob, name);
        } catch {
          setAutoDownloadFailed(true);
        }
      } catch (e) {
        if (ac.signal.aborted) return;
        setPhase("error");
        if (e instanceof CreatorGuardPdfError) {
          setErrorDetail(e.message);
        } else {
          setErrorDetail(tRef.current.claimPageError);
        }
      }
    })();

    return () => ac.abort();
  }, [email, fileUrl, fileId]);

  const onManualDownload = useCallback(() => {
    if (!outputBlob) return;
    try {
      triggerBrowserDownload(outputBlob, downloadFileName);
      setAutoDownloadFailed(false);
    } catch {
      setAutoDownloadFailed(true);
    }
  }, [outputBlob, downloadFileName]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto flex max-w-lg flex-col gap-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Claim</h1>
            <p className="mt-1 text-sm text-slate-500">
              Creator Guard · personalized delivery
            </p>
          </div>
          <LanguageSelector />
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/40 p-6 shadow-xl shadow-black/20">
          {phase === "fetching" ? (
            <div className="flex gap-4">
              <span className="text-2xl" aria-hidden>
                🚀
              </span>
              <div>
                <p className="font-medium text-slate-100">
                  {t.claimPageLoading}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {email ? (
                    <span className="break-all text-slate-400">{email}</span>
                  ) : null}
                </p>
              </div>
            </div>
          ) : null}

          {phase === "embedding" ? (
            <div className="flex gap-4">
              <span className="text-2xl" aria-hidden>
                🕵️‍♂️
              </span>
              <div>
                <p className="font-medium text-slate-100">
                  {tpl(t.claimPageFingerprinting, { email })}
                </p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-sky-500/70" />
                </div>
              </div>
            </div>
          ) : null}

          {phase === "success" ? (
            <div className="space-y-5">
              <div className="flex gap-4">
                <span className="text-2xl" aria-hidden>
                  ✅
                </span>
                <p className="font-medium text-emerald-100/95">
                  {t.claimPageSuccess}
                </p>
              </div>
              <button
                type="button"
                onClick={onManualDownload}
                className={`w-full rounded-xl border border-sky-500/40 bg-sky-500/15 py-3 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/25 ${
                  autoDownloadFailed
                    ? "ring-2 ring-amber-400/40 ring-offset-2 ring-offset-slate-900"
                    : ""
                }`}
              >
                {t.claimPageManualDownload}
              </button>
            </div>
          ) : null}

          {phase === "error" && errorDetail ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-red-200/95">
                {t.claimPageError}
              </p>
              <p className="text-sm text-red-200/70">{errorDetail}</p>
            </div>
          ) : null}
        </div>

        <Link
          href="/"
          className="text-sm text-sky-400 underline-offset-4 hover:underline"
        >
          ← Creator Guard home
        </Link>
      </div>
    </main>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={<ClaimSuspenseFallback />}>
      <ClaimContent />
    </Suspense>
  );
}
