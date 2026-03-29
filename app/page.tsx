"use client";

import { LanguageSelector } from "@/components/LanguageSelector";
import { linksReadyManyTemplate } from "@/lib/i18n/dictionary";
import { useLanguage } from "@/lib/i18n/language-context";
import type { Messages } from "@/lib/i18n/types";
import { useCallback, useEffect, useState } from "react";

type Row = { name: string; path: string };

const STORAGE_KEY = "creatorGuardCreatorId";

function parseMemberNames(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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

export default function Home() {
  const { t } = useLanguage();
  const [creatorIdInput, setCreatorIdInput] = useState("");
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCreatorIdInput(saved);
    } catch {
      /* ignore */
    }
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

  const generate = useCallback(() => {
    const names = parseMemberNames(input);
    setRows(
      names.map((name) => ({
        name,
        path: `/api/protect?userId=${encodeURIComponent(name)}`,
      }))
    );
  }, [input]);

  const copyLink = useCallback(async (path: string) => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const full = origin ? `${origin}${path}` : path;
    try {
      await navigator.clipboard.writeText(full);
      setCopiedPath(path);
      window.setTimeout(() => setCopiedPath(null), 2000);
    } catch {
      setCopiedPath(null);
    }
  }, []);

  return (
    <div className="relative mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute right-4 top-4 z-20 sm:right-6 lg:right-8">
        <div className="pointer-events-auto">
          <LanguageSelector />
        </div>
      </div>

      <header className="mb-10 border-b border-slate-800/80 pb-8 pr-28 sm:pr-36">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-400/90">
          {t.heroSubtitle}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {t.heroTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          {t.heroDescription}
        </p>
      </header>

      <section className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-6 shadow-xl sm:p-8">
        <h2 className="text-sm font-semibold text-emerald-200/90">
          {t.step1Title}
        </h2>
        <p className="mt-1 text-sm text-slate-400">{t.step1Body}</p>
        <label
          htmlFor="creator-id"
          className="mt-4 block text-sm font-medium text-slate-300"
        >
          {t.yourCreatorId}
        </label>
        <input
          id="creator-id"
          type="text"
          value={creatorIdInput}
          onChange={(e) => setCreatorIdInput(e.target.value)}
          placeholder={t.creatorIdPlaceholder}
          className="mt-2 w-full max-w-xl rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        {creatorLabel ? (
          <div className="mt-4 rounded-xl border border-slate-800/80 bg-slate-950/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t.globalAccessLink}
            </p>
            <code className="mt-2 block break-all text-sm text-emerald-300/95">
              {origin}
              {globalPath}
            </code>
            <button
              type="button"
              onClick={() => copyLink(globalPath)}
              className="mt-3 rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-4 py-2 text-xs font-medium text-emerald-100 transition hover:bg-emerald-900/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              {copiedPath === globalPath ? t.copied : t.copyGlobalLink}
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">{t.enterCreatorIdHint}</p>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 shadow-xl shadow-black/20 backdrop-blur-sm sm:p-8">
        <h2 className="text-sm font-semibold text-slate-200">{t.step2Title}</h2>
        <p className="mt-1 text-sm text-slate-500">{t.step2Body}</p>
        <label
          htmlFor="members"
          className="mt-4 block text-sm font-medium text-slate-300"
        >
          {t.memberNamesLabel}
        </label>
        <textarea
          id="members"
          rows={5}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.memberNamesPlaceholder}
          className="mt-2 w-full resize-y rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/25"
        />
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={generate}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-teal-600 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-900/30 transition hover:from-cyan-400 hover:to-teal-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
          >
            {t.generateEncryptedLinks}
          </button>
          {rows.length > 0 && (
            <>
              <span className="text-sm text-slate-500">
                {rows.length === 1
                  ? t.linksReadyOne
                  : linksReadyManyTemplate(rows.length, t.linksReadyMany)}
              </span>
              <button
                type="button"
                onClick={() => downloadCsv(rows, t)}
                className="rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/40"
              >
                {t.downloadCsv}
              </button>
            </>
          )}
        </div>
      </section>

      {rows.length > 0 && (
        <section className="mt-10 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/30">
          <div className="border-b border-slate-800/80 px-6 py-4">
            <h2 className="text-sm font-semibold text-slate-200">
              {t.individualTrackedTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {t.individualTrackedHint}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-950/50 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-3 font-medium">{t.tableMemberName}</th>
                  <th className="px-6 py-3 font-medium">{t.tableUniqueLink}</th>
                  <th className="px-6 py-3 font-medium">{t.tableActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rows.map((row) => (
                  <tr
                    key={row.path}
                    className="transition-colors hover:bg-slate-800/30"
                  >
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-200">
                      {row.name}
                    </td>
                    <td className="max-w-md px-6 py-4">
                      <code className="break-all text-xs text-cyan-300/90">
                        {row.path}
                      </code>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <button
                        type="button"
                        onClick={() => copyLink(row.path)}
                        className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-500/50 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                      >
                        {copiedPath === row.path ? t.copied : t.copyLink}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
