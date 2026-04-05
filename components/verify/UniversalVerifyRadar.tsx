"use client";

import type { Messages } from "@/lib/i18n/types";
import { useEffect, useMemo, useState } from "react";

export type UniversalVerifyKind = "image" | "pdf" | "video" | "unknown";

export type UniversalRadarOutcome =
  | "pending"
  | "image_found"
  | "image_clean"
  | "pdf_found"
  | "pdf_clean"
  | "video_preview";

function tpl(s: string, vars: Record<string, string>): string {
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}

const BASE_STEP_COUNT = 5;
const TOTAL_WITH_OUTCOME = 6;
const STEP_MS = 520;

function radarNameForKind(kind: UniversalVerifyKind, t: Messages): string {
  switch (kind) {
    case "image":
      return t.verifyRadarNameImage;
    case "pdf":
      return t.verifyRadarNamePdf;
    case "video":
      return t.verifyRadarNameVideo;
    default:
      return t.verifyRadarNameUnknown;
  }
}

export function UniversalVerifyRadar({
  active,
  kind,
  mime,
  outcome,
  t,
}: {
  active: boolean;
  kind: UniversalVerifyKind;
  mime: string;
  outcome: UniversalRadarOutcome;
  t: Messages;
}) {
  const [lineCount, setLineCount] = useState(0);

  const lines = useMemo(() => {
    const mimeLine = tpl(t.verifyRadarMimeDetected, {
      mime: mime || "application/octet-stream",
      radarName: radarNameForKind(kind, t),
    });
    const mid = [
      t.verifyUniversalScan1,
      t.verifyUniversalScan2,
      t.verifyUniversalScan3,
      t.verifyUniversalScan4,
    ];
    const doneOutcome = active ? "pending" : outcome;
    let last = "";
    if (doneOutcome === "image_found") last = t.verifyUniversalOutcomeImageFound;
    else if (doneOutcome === "image_clean")
      last = t.verifyUniversalOutcomeImageClean;
    else if (doneOutcome === "pdf_found") last = t.verifyUniversalOutcomePdfFound;
    else if (doneOutcome === "pdf_clean") last = t.verifyUniversalOutcomePdfClean;
    else if (doneOutcome === "video_preview")
      last = t.verifyUniversalOutcomeVideo;
    return last ? [mimeLine, ...mid, last] : [mimeLine, ...mid];
  }, [t, kind, mime, outcome, active]);

  useEffect(() => {
    if (!active) {
      setLineCount(0);
      return;
    }
    setLineCount(1);
    const id = window.setInterval(() => {
      setLineCount((c) => (c < BASE_STEP_COUNT ? c + 1 : c));
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (active) return;
    if (outcome !== "pending") {
      setLineCount(TOTAL_WITH_OUTCOME);
    }
  }, [active, outcome]);

  const visible =
    active || outcome !== "pending"
      ? active
        ? lines.slice(0, Math.min(lineCount, BASE_STEP_COUNT))
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
              "conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(34,211,238,0.5) 42deg, rgba(6,182,212,0.35) 72deg, transparent 110deg)",
            filter: "blur(14px)",
            animation: "verify-radar-spin 2s linear infinite",
          }}
          aria-hidden
        />
        <div
          className="relative z-[1] h-24 w-24 rounded-full border-2 border-cyan-500/40 bg-slate-950/90 shadow-[0_0_40px_rgba(34,211,238,0.2)]"
          style={{
            background:
              "conic-gradient(from 0deg at 50% 50%, rgba(15,23,42,0.95) 0deg, rgba(8,145,178,0.35) 90deg, rgba(15,23,42,0.95) 180deg, rgba(14,116,144,0.3) 270deg, rgba(15,23,42,0.95) 360deg)",
            animation: "verify-radar-spin 3.2s linear infinite reverse",
          }}
        />
        <div className="absolute z-[2] h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
      </div>

      <div className="min-w-0 flex-1 rounded-xl border border-cyan-900/40 bg-black/70 p-4 font-mono text-[11px] leading-relaxed text-cyan-400/95 shadow-inner shadow-black/40 sm:min-h-[11rem]">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-cyan-500/80">
          {t.verifyUniversalRadarTitle}
        </p>
        <ul className="space-y-1.5">
          {visible.map((line, i) => (
            <li
              key={`${i}-${line.slice(0, 16)}`}
              className={
                i === visible.length - 1 && !active
                  ? "text-amber-300/95"
                  : undefined
              }
            >
              {line}
              {active && i === visible.length - 1 ? (
                <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-cyan-400/80 align-middle" />
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
