"use client";

import type { Messages } from "@/lib/i18n/types";
import { useEffect, useMemo, useState } from "react";

type ScanOutcome = "pending" | "found" | "clean";

/** Base terminal lines before outcome (stream → … → SHA cross-ref). */
const BASE_STEP_TARGET = 6;
const TOTAL_WITH_OUTCOME = 7;
const STEP_MS = 550;

export function ScanningRadar({
  active,
  outcome,
  t,
}: {
  active: boolean;
  outcome: ScanOutcome;
  t: Messages;
}) {
  const [lineCount, setLineCount] = useState(0);

  const lines = useMemo(() => {
    const base = [
      t.verifyPdfScanLineStream,
      t.verifyPdfScanLineStructure,
      t.verifyPdfScanLineKeywords,
      t.verifyPdfScanLineCorrelate,
      t.verifyPdfScanLineDeepBuffer,
      t.verifyPdfScanLineShaCrossRef,
    ];
    if (outcome === "found") base.push(t.verifyPdfScanLineFound);
    else if (outcome === "clean") base.push(t.verifyPdfScanLineClean);
    return base;
  }, [t, outcome]);

  useEffect(() => {
    if (!active) {
      setLineCount(0);
      return;
    }
    setLineCount(1);
    const id = window.setInterval(() => {
      setLineCount((c) => (c < BASE_STEP_TARGET ? c + 1 : c));
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (active) return;
    if (outcome === "found" || outcome === "clean") {
      setLineCount(TOTAL_WITH_OUTCOME);
    }
  }, [active, outcome]);

  const visible =
    active || outcome !== "pending"
      ? active
        ? lines.slice(0, Math.min(lineCount, BASE_STEP_TARGET))
        : lines.slice(0, TOTAL_WITH_OUTCOME)
      : [];

  if (!active && outcome === "pending" && visible.length === 0) return null;

  return (
    <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-stretch">
      <div className="relative mx-auto flex h-36 w-36 shrink-0 items-center justify-center sm:mx-0">
        <div
          className="absolute inset-2 rounded-full opacity-[0.85]"
          style={{
            background:
              "conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(248,113,113,0.55) 42deg, rgba(239,68,68,0.35) 72deg, transparent 110deg)",
            filter: "blur(14px)",
            animation: "verify-radar-spin 2s linear infinite",
          }}
          aria-hidden
        />
        <div
          className="relative z-[1] h-24 w-24 rounded-full border-2 border-red-500/40 bg-slate-950/90 shadow-[0_0_40px_rgba(239,68,68,0.25)]"
          style={{
            background:
              "conic-gradient(from 0deg at 50% 50%, rgba(30,41,59,0.95) 0deg, rgba(127,29,29,0.4) 90deg, rgba(30,41,59,0.95) 180deg, rgba(185,28,28,0.35) 270deg, rgba(30,41,59,0.95) 360deg)",
            animation: "verify-radar-spin 3.2s linear infinite reverse",
          }}
        />
        <div className="absolute z-[2] h-2 w-2 rounded-full bg-red-400 shadow-[0_0_12px_#f87171]" />
      </div>

      <div className="min-w-0 flex-1 rounded-xl border border-emerald-900/40 bg-black/70 p-4 font-mono text-[11px] leading-relaxed text-emerald-400/95 shadow-inner shadow-black/40 sm:min-h-[11rem]">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-500/80">
          {t.verifyPdfScanProgressTitle}
        </p>
        <ul className="space-y-1.5">
          {visible.map((line, i) => (
            <li
              key={`${i}-${line.slice(0, 12)}`}
              className={
                i === visible.length - 1 && !active
                  ? "text-amber-300/95"
                  : undefined
              }
            >
              {line}
              {active && i === visible.length - 1 ? (
                <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-emerald-400/80 align-middle" />
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
