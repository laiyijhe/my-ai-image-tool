"use client";

/**
 * Member portal, global ID, and mass image delivery — mounted at `/[lang]/portal`.
 */

import { LanguageSelector } from "@/components/LanguageSelector";
import { isLocale, linksReadyManyTemplate } from "@/lib/i18n/dictionary";
import { useLanguage } from "@/lib/i18n/language-context";
import type { Locale, Messages } from "@/lib/i18n/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

type Row = { name: string; path: string };

type MassRow = {
  key: string;
  memberName: string;
  imageFileName: string;
  previewUrl: string;
  path: string;
};

type GalleryItem = { file: File; previewUrl: string };

function replaceTpl(s: string, vars: Record<string, string>): string {
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}

const STORAGE_KEY = "creatorGuardCreatorId";

const CSV_HEADER_RE =
  /^(name|member|username|email|user|用戶|姓名|会员|會員|名前|会員名|nickname|id)$/i;

function makeDefaultCreatorId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return `studio-${crypto.randomUUID().slice(0, 8)}`;
    }
  } catch {
    /* ignore */
  }
  return `studio-${Math.random().toString(36).slice(2, 10)}`;
}

function parseMemberListFromText(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (lines.length > 1) {
    const names: string[] = [];
    let i = 0;
    const firstCell =
      lines[0].split(",")[0]?.replace(/^"|"$/g, "").trim() || "";
    if (CSV_HEADER_RE.test(firstCell)) i = 1;
    for (; i < lines.length; i++) {
      const cell = lines[i].split(",")[0]?.replace(/^"|"$/g, "").trim();
      if (cell && !CSV_HEADER_RE.test(cell)) names.push(cell);
    }
    return [...new Set(names)];
  }

  const parts = t
    .split(",")
    .map((s) => s.replace(/^"|"$/g, "").trim())
    .filter(Boolean);
  if (parts.length === 0) return [];
  let start = 0;
  if (CSV_HEADER_RE.test(parts[0])) start = 1;
  return [...new Set(parts.slice(start))];
}

function normalizeCreatorId(raw: string): string {
  return raw.trim().slice(0, 128);
}

function escapeCsvCell(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadCsv(rows: Row[], t: Messages) {
  if (typeof window === "undefined" || rows.length === 0) return;
  const origin = window.location.origin;
  const header =
    [
      escapeCsvCell(t.csvHeaderMemberName),
      escapeCsvCell(t.csvHeaderFullUrl),
      escapeCsvCell(t.csvHeaderPath),
    ].join(",") + "\n";
  const lines = rows.map((r) => {
    const full = `${origin}${r.path}`;
    return [
      escapeCsvCell(r.name),
      escapeCsvCell(full),
      escapeCsvCell(r.path),
    ].join(",");
  });
  const blob = new Blob([header + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `creator-guard-links-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadMassCsv(rows: MassRow[], t: Messages, origin: string) {
  if (typeof window === "undefined" || rows.length === 0) return;
  const header =
    [
      escapeCsvCell(t.csvHeaderMemberName),
      escapeCsvCell(t.massCsvHeaderImage),
      escapeCsvCell(t.csvHeaderFullUrl),
      escapeCsvCell(t.csvHeaderPath),
    ].join(",") + "\n";
  const lines = rows.map((r) => {
    const full = `${origin}${r.path}`;
    return [
      escapeCsvCell(r.memberName),
      escapeCsvCell(r.imageFileName),
      escapeCsvCell(full),
      escapeCsvCell(r.path),
    ].join(",");
  });
  const blob = new Blob([header + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `creator-guard-mass-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function useClientOrigin(): string {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );
}

function SpinnerRing({ className }: { className?: string }) {
  return (
    <div
      className={`shrink-0 animate-spin rounded-full border-2 border-cyan-400/25 border-t-cyan-400 ${className ?? "h-5 w-5"}`}
      aria-hidden
    />
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4.5 10.5 8.2 14.2 15.5 6" />
    </svg>
  );
}

/** Minimal dark glass panel — Apple-like weight. */
const GLASS_PANEL =
  "rounded-[1.75rem] border border-white/[0.06] bg-white/[0.035] shadow-[0_12px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl";

type ToastPayload = {
  message: string;
  hint?: string;
  variant: "error" | "success";
};

function ToastBanner({
  toast,
  onDismiss,
  dismissLabel,
}: {
  toast: ToastPayload;
  onDismiss: () => void;
  dismissLabel: string;
}) {
  const isErr = toast.variant === "error";
  return (
    <div
      className="pointer-events-auto fixed bottom-6 left-1/2 z-[100] w-[min(100%-2rem,26rem)] -translate-x-1/2"
      role="alert"
    >
      <div
        className={`rounded-2xl border px-4 py-3.5 shadow-2xl backdrop-blur-xl ${
          isErr
            ? "border-red-500/25 bg-red-950/85 text-red-50"
            : "border-emerald-500/25 bg-emerald-950/85 text-emerald-50"
        }`}
      >
        <div className="flex gap-3">
          <p className="min-w-0 flex-1 text-sm font-medium leading-snug">
            {toast.message}
          </p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={dismissLabel}
            className="shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold opacity-70 transition hover:opacity-100"
          >
            ✕
          </button>
        </div>
        {toast.hint ? (
          <p className="mt-2 text-xs leading-relaxed opacity-85">{toast.hint}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function PortalDashboard() {
  const params = useParams();
  const lang: Locale =
    typeof params?.lang === "string" && isLocale(params.lang)
      ? params.lang
      : "en";
  const lp = `/${lang}`;
  const { t } = useLanguage();
  const origin = useClientOrigin();
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [creatorIdInput, setCreatorIdInput] = useState("");
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [massRows, setMassRows] = useState<MassRow[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [massPhase, setMassPhase] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [massProgress, setMassProgress] = useState({ done: 0, total: 0 });
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [copyPopPath, setCopyPopPath] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [massDragOver, setMassDragOver] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastPayload | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    startTransition(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved?.trim()) setCreatorIdInput(saved.trim());
        else setCreatorIdInput(makeDefaultCreatorId());
      } catch {
        setCreatorIdInput(makeDefaultCreatorId());
      }
    });
  }, []);

  const creatorLabel = normalizeCreatorId(creatorIdInput);
  const globalPath = creatorLabel
    ? `/view/${encodeURIComponent(creatorLabel)}`
    : "";

  useEffect(() => {
    if (!creatorLabel) return;
    try {
      localStorage.setItem(STORAGE_KEY, creatorLabel);
    } catch {
      /* ignore */
    }
  }, [creatorLabel]);

  const copyLink = useCallback(async (path: string) => {
    const o = typeof window !== "undefined" ? window.location.origin : "";
    const full = o ? `${o}${path}` : path;
    try {
      await navigator.clipboard.writeText(full);
      setCopiedPath(path);
      setCopyPopPath(path);
      window.setTimeout(() => setCopiedPath(null), 2200);
      window.setTimeout(() => setCopyPopPath(null), 650);
    } catch {
      setCopiedPath(null);
      setCopyPopPath(null);
    }
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const pushToast = useCallback(
    (message: string, variant: "error" | "success", hint?: string) => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      setToast({ message, variant, hint });
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, 5600);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const ingestFile = useCallback((file: File) => {
    setUploadLabel(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const names = parseMemberListFromText(text);
      if (names.length) setInput(names.join(", "));
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const addGalleryFromFiles = useCallback((files: FileList | File[]) => {
    const imgs = Array.from(files).filter(
      (f) =>
        f.type.startsWith("image/") ||
        /\.(jpe?g|png|gif|webp|avif|heic)$/i.test(f.name)
    );
    if (imgs.length === 0) return;
    setGalleryItems((prev) => {
      const next = [...prev];
      for (const file of imgs) {
        next.push({ file, previewUrl: URL.createObjectURL(file) });
      }
      return next;
    });
  }, []);

  const clearGallery = useCallback(() => {
    setGalleryItems((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
    setMassRows([]);
    setMassPhase("idle");
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f && (f.name.endsWith(".csv") || f.name.endsWith(".txt") || f.type.startsWith("text/")))
        ingestFile(f);
    },
    [ingestFile]
  );

  const generateEverything = useCallback(() => {
    const names = parseMemberListFromText(input);
    if (names.length === 0) {
      pushToast(t.needMembersHint, "error");
      return;
    }
    let id = normalizeCreatorId(creatorIdInput);
    if (!id) {
      id = makeDefaultCreatorId();
      setCreatorIdInput(id);
    }
    setMassRows([]);
    setMassPhase("idle");
    setRows(
      names.map((name) => ({
        name,
        path: `/api/protect?userId=${encodeURIComponent(name)}`,
      }))
    );
  }, [creatorIdInput, input, pushToast, t.needMembersHint]);

  const generateMassBatches = useCallback(async () => {
    const names = parseMemberListFromText(input);
    if (names.length === 0) {
      pushToast(t.needMembersHint, "error");
      return;
    }
    if (galleryItems.length === 0) {
      pushToast(t.massNeedImagesHint, "error");
      return;
    }

    setRows([]);
    setMassRows([]);
    setMassPhase("uploading");
    setMassProgress({ done: 0, total: galleryItems.length });

    try {
      const urls: string[] = [];
      for (let i = 0; i < galleryItems.length; i++) {
        const fd = new FormData();
        fd.set("file", galleryItems[i]!.file);
        const res = await fetch("/api/protect/gallery-upload", {
          method: "POST",
          body: fd,
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          url?: string;
        };
        if (!res.ok) {
          if (res.status === 503 || data.error === "blob_not_configured") {
            throw new Error(t.massBlobUnavailable);
          }
          throw new Error(t.massUploadFailed);
        }
        if (!data.url) throw new Error(t.massUploadFailed);
        urls.push(data.url);
        setMassProgress({ done: i + 1, total: galleryItems.length });
      }

      const nextRows: MassRow[] = [];
      for (const member of names) {
        for (let j = 0; j < galleryItems.length; j++) {
          const gi = galleryItems[j]!;
          const hostedUrl = urls[j]!;
          nextRows.push({
            key: `${member}|${j}|${gi.file.name}`,
            memberName: member,
            imageFileName: gi.file.name,
            previewUrl: gi.previewUrl,
            path: `/api/protect?memberId=${encodeURIComponent(member)}&imageUrl=${encodeURIComponent(hostedUrl)}`,
          });
        }
      }
      setMassRows(nextRows);
      setMassPhase("done");
    } catch (e) {
      setMassPhase("error");
      pushToast(
        e instanceof Error ? e.message : t.massUploadFailed,
        "error"
      );
    }
  }, [
    galleryItems,
    input,
    pushToast,
    t.massBlobUnavailable,
    t.massUploadFailed,
    t.needMembersHint,
    t.massNeedImagesHint,
  ]);

  const regenCreatorId = useCallback(() => {
    setCreatorIdInput(makeDefaultCreatorId());
  }, []);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.12),transparent)]" />

      <div className="relative mx-auto max-w-2xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <div className="mb-8 flex justify-end">
          <LanguageSelector />
        </div>

        <header className="mb-10 border-b border-white/[0.06] pb-8">
          <Link
            href={lp}
            className="text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
          >
            {t.portalBackHome}
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {t.portalWorkspaceTitle}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            {t.portalWorkspaceSubtitle}
          </p>
        </header>

        <div className="space-y-6">
          {/* Portal ID */}
          <section className={`${GLASS_PANEL} p-5 sm:p-6`}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                {t.portalYourId}
              </span>
              <button
                type="button"
                onClick={regenCreatorId}
                aria-label={t.regenCreatorAria}
                className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-slate-400 transition hover:border-cyan-500/30 hover:text-cyan-200/90"
              >
                {t.creatorNewId}
              </button>
            </div>
            <input
              type="text"
              value={creatorIdInput}
              onChange={(e) => setCreatorIdInput(e.target.value)}
              placeholder={t.creatorIdPlaceholder}
              className="mt-3 w-full rounded-2xl border border-white/[0.07] bg-black/30 px-4 py-3.5 text-[15px] font-medium tracking-tight text-white placeholder:text-slate-600 focus:border-cyan-500/35 focus:outline-none focus:ring-2 focus:ring-cyan-500/15"
            />
            <p className="mt-2 text-xs text-slate-500">{t.creatorTapToEdit}</p>

            {creatorLabel && globalPath ? (
              <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70">
                    {t.globalAccessLink}
                  </p>
                  <p className="mt-1 truncate font-mono text-sm text-emerald-100/90">
                    {origin}
                    {globalPath}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyLink(globalPath)}
                  className={`relative flex h-11 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full px-6 text-sm font-semibold transition-all duration-300 ${
                    copiedPath === globalPath
                      ? "bg-emerald-500/25 text-emerald-200 ring-2 ring-emerald-400/50 copy-success-pop"
                      : "bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 shadow-lg shadow-emerald-900/30 hover:brightness-110 active:scale-[0.98]"
                  }`}
                >
                  {copiedPath === globalPath ? (
                    <>
                      <CheckIcon className="h-4 w-4" />
                      <span>{t.copied}</span>
                    </>
                  ) : (
                    <span>{t.copyGlobalLink}</span>
                  )}
                </button>
              </div>
            ) : null}
          </section>

          {/* Members + drop */}
          <section className={`${GLASS_PANEL} p-5 sm:p-6`}>
            <button
              type="button"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-10 transition-all duration-200 ${
                dragOver
                  ? "border-cyan-400/55 bg-cyan-500/10"
                  : "border-white/[0.1] bg-black/20 hover:border-white/20 hover:bg-white/[0.03]"
              }`}
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] text-cyan-400/90">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M12 5v14M5 12l7-7 7 7" />
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-200">
                {t.dropZoneTitle}
              </span>
              <span className="mt-1 text-center text-xs text-slate-500">
                {t.dropZoneSubtitle}
              </span>
              <span className="mt-4 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs font-medium text-slate-400">
                {t.browseButton}
              </span>
              {uploadLabel ? (
                <span className="mt-3 text-[11px] text-cyan-500/80">
                  {uploadLabel}
                </span>
              ) : null}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) ingestFile(f);
                e.target.value = "";
              }}
            />

            <label
              htmlFor="quick-names"
              className="mt-5 block text-xs font-medium uppercase tracking-wider text-slate-500"
            >
              {t.optionalNamesLabel}
            </label>
            <input
              id="quick-names"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.compactNamesPlaceholder}
              className="mt-2 w-full rounded-2xl border border-white/[0.07] bg-black/30 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/35 focus:outline-none focus:ring-2 focus:ring-cyan-500/15"
            />

            <button
              type="button"
              onClick={generateEverything}
              disabled={massPhase === "uploading"}
              className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-500 text-[15px] font-semibold text-slate-950 shadow-xl shadow-cyan-900/25 transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {t.generateAllCta}
            </button>
          </section>

          {/* Mass protection gallery */}
          <section className={`${GLASS_PANEL} p-5 sm:p-6`}>
            <div className="mb-4">
              <h2 className="text-sm font-semibold tracking-tight text-white">
                {t.massProtectionTitle}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {t.massProtectionHint}
              </p>
            </div>

            <button
              type="button"
              onDragOver={(e) => {
                e.preventDefault();
                setMassDragOver(true);
              }}
              onDragLeave={() => setMassDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setMassDragOver(false);
                addGalleryFromFiles(e.dataTransfer.files);
              }}
              onClick={() => galleryInputRef.current?.click()}
              className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-10 transition-all duration-200 ${
                massDragOver
                  ? "border-violet-400/55 bg-violet-500/10"
                  : "border-white/[0.1] bg-black/20 hover:border-white/20 hover:bg-white/[0.03]"
              }`}
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] text-violet-400/90">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-200">
                {t.massGalleryDropTitle}
              </span>
              <span className="mt-1 text-center text-xs text-slate-500">
                {t.massGalleryHint}
              </span>
              <span className="mt-4 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs font-medium text-slate-400">
                {t.massGalleryBrowse}
              </span>
              {galleryItems.length > 0 ? (
                <p className="mt-3 text-[11px] font-medium text-violet-400/85">
                  {replaceTpl(t.massImagesSelected, {
                    count: String(galleryItems.length),
                  })}
                </p>
              ) : null}
            </button>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const list = e.target.files;
                if (list?.length) addGalleryFromFiles(list);
                e.target.value = "";
              }}
            />

            {galleryItems.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {galleryItems.map((g, idx) => (
                  <div
                    key={`${g.previewUrl}-${idx}`}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/25 py-1.5 pl-1.5 pr-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.previewUrl}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                    <span className="max-w-[140px] truncate text-[11px] text-slate-400">
                      {g.file.name}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={clearGallery}
                disabled={galleryItems.length === 0 || massPhase === "uploading"}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-white/[0.08] disabled:opacity-40"
              >
                {t.massGalleryClear}
              </button>
            </div>

            {massPhase === "uploading" ? (
              <div className="mt-5 space-y-3 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-4">
                <div className="flex items-center gap-3">
                  <SpinnerRing />
                  <span className="text-sm text-cyan-200/90">
                    {t.massUploadingLabel}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-teal-500 transition-[width] duration-300 ease-out"
                    style={{
                      width: `${massProgress.total ? (100 * massProgress.done) / massProgress.total : 0}%`,
                    }}
                  />
                </div>
                <p className="text-center text-[11px] text-slate-500">
                  {replaceTpl(t.massUploadProgress, {
                    done: String(massProgress.done),
                    total: String(massProgress.total),
                  })}
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void generateMassBatches()}
              disabled={massPhase === "uploading"}
              className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 via-violet-600 to-fuchsia-600 text-[15px] font-semibold text-white shadow-xl shadow-violet-950/40 transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {massPhase === "uploading" ? (
                <>
                  <SpinnerRing className="h-5 w-5 border-white/30 border-t-white" />
                  <span>{t.massUploadingLabel}</span>
                </>
              ) : (
                t.massGenerateBatchesCta
              )}
            </button>
          </section>

          {/* Results */}
          {massRows.length > 0 ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <p className="text-sm text-slate-400">
                  {replaceTpl(t.massLinksReady, {
                    count: String(massRows.length),
                  })}
                </p>
                <button
                  type="button"
                  onClick={() => downloadMassCsv(massRows, t, origin)}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.09]"
                >
                  {t.massDownloadCsvAll}
                </button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-slate-900/50">
                <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">{t.massTableMember}</th>
                      <th className="px-4 py-3">{t.massTableImage}</th>
                      <th className="px-4 py-3 text-right">
                        {t.massTableLink}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {massRows.map((row) => {
                      const isCopied = copiedPath === row.path;
                      const showPop = copyPopPath === row.path;
                      return (
                        <tr
                          key={row.key}
                          className="border-b border-white/[0.04] last:border-0"
                        >
                          <td className="px-4 py-3 align-middle font-medium text-white">
                            {row.memberName}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={row.previewUrl}
                                alt=""
                                className="h-14 w-14 shrink-0 rounded-xl border border-white/[0.08] object-cover"
                              />
                              <span className="max-w-[120px] truncate text-xs text-slate-500 sm:max-w-[180px]">
                                {row.imageFileName}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle text-right">
                            <button
                              type="button"
                              onClick={() => copyLink(row.path)}
                              className={`relative inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                                isCopied
                                  ? "bg-emerald-500/20 text-emerald-200 ring-2 ring-emerald-400/45"
                                  : "bg-white/[0.1] text-slate-100 ring-1 ring-white/10 hover:bg-white/[0.14]"
                              } ${showPop ? "copy-success-pop" : ""}`}
                            >
                              {isCopied ? (
                                <>
                                  <CheckIcon className="h-3.5 w-3.5 text-emerald-300" />
                                  <span>{t.copied}</span>
                                </>
                              ) : (
                                <span>{t.massCopyUniqueLink}</span>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {rows.length > 0 && massRows.length === 0 ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <p className="text-sm text-slate-400">
                  {rows.length === 1
                    ? t.linksReadyOne
                    : linksReadyManyTemplate(rows.length, t.linksReadyMany)}
                </p>
                <button
                  type="button"
                  onClick={() => downloadCsv(rows, t)}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.09]"
                >
                  {t.downloadCsv}
                </button>
              </div>
              <ul className="grid gap-3 sm:grid-cols-1">
                {rows.map((row) => {
                  const isCopied = copiedPath === row.path;
                  const showPop = copyPopPath === row.path;
                  return (
                    <li
                      key={row.path}
                      className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-slate-900/50 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">
                          {row.name}
                        </p>
                        <p className="mt-1 truncate font-mono text-xs text-cyan-400/75">
                          {row.path}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyLink(row.path)}
                        className={`relative flex h-11 min-w-[7.5rem] shrink-0 items-center justify-center gap-2 overflow-hidden rounded-full px-5 text-sm font-semibold transition-all duration-300 ${
                          isCopied
                            ? "bg-emerald-500/20 text-emerald-200 ring-2 ring-emerald-400/45"
                            : "bg-white/[0.1] text-slate-100 ring-1 ring-white/10 hover:bg-white/[0.14]"
                        } ${showPop ? "copy-success-pop" : ""}`}
                      >
                        <span
                          className={`flex items-center gap-2 transition-all duration-200 ${
                            isCopied ? "opacity-100" : "opacity-100"
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <CheckIcon className="h-4 w-4 text-emerald-300" />
                              <span>{t.copied}</span>
                            </>
                          ) : (
                            <span>{t.copyLink}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

        </div>

        {toast ? (
          <ToastBanner
            toast={toast}
            onDismiss={dismissToast}
            dismissLabel={t.toastDismissAria}
          />
        ) : null}

        <footer className="mt-14 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-white/[0.06] pt-10 text-center">
          <Link
            href={`${lp}/protect/pdf`}
            className="text-sm font-medium text-cyan-400/80 transition hover:text-cyan-300"
          >
            {t.homeCtaStartProtecting}
          </Link>
          <Link
            href={`${lp}/verify`}
            className="text-sm font-medium text-cyan-400/80 transition hover:text-cyan-300"
          >
            {t.homeCtaVerifyEvidence}
          </Link>
        </footer>
      </div>
    </div>
  );
}
