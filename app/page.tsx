"use client";

/**
 * CRITICAL: Root route `/` — Creator Guard dashboard only.
 * Multi-language UI via lib/i18n/dictionary.ts.
 */

import { LanguageSelector } from "@/components/LanguageSelector";
import { linksReadyManyTemplate } from "@/lib/i18n/dictionary";
import { useLanguage } from "@/lib/i18n/language-context";
import type { Messages } from "@/lib/i18n/types";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

type Row = { name: string; path: string };

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

function useClientOrigin(): string {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
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

export default function Home() {
  const { t } = useLanguage();
  const origin = useClientOrigin();
  const fileRef = useRef<HTMLInputElement>(null);
  const [creatorIdInput, setCreatorIdInput] = useState("");
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [copyPopPath, setCopyPopPath] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [needMembers, setNeedMembers] = useState(false);

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
      setNeedMembers(true);
      window.setTimeout(() => setNeedMembers(false), 3800);
      return;
    }
    let id = normalizeCreatorId(creatorIdInput);
    if (!id) {
      id = makeDefaultCreatorId();
      setCreatorIdInput(id);
    }
    setRows(
      names.map((name) => ({
        name,
        path: `/api/protect?userId=${encodeURIComponent(name)}`,
      }))
    );
  }, [creatorIdInput, input]);

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

        <header className="mb-10 text-center sm:mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-400/85">
            {t.heroSubtitle}
          </p>
          <h1 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {t.heroTitle}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
            {t.heroTagline}
          </p>
        </header>

        <div className="space-y-5">
          {/* Portal ID */}
          <section className="rounded-[1.35rem] border border-white/[0.08] bg-slate-900/60 p-5 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-6">
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
          <section className="rounded-[1.35rem] border border-white/[0.08] bg-slate-900/60 p-5 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-6">
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

            {needMembers ? (
              <p className="mt-3 text-center text-sm text-amber-400/90">
                {t.needMembersHint}
              </p>
            ) : null}

            <button
              type="button"
              onClick={generateEverything}
              className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-teal-500 text-[15px] font-semibold text-slate-950 shadow-xl shadow-cyan-900/25 transition hover:brightness-105 active:scale-[0.99]"
            >
              {t.generateAllCta}
            </button>
          </section>

          {/* Results */}
          {rows.length > 0 ? (
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
      </div>
    </div>
  );
}
