"use client";

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useState } from "react";

type ProcessingOverlayProps = {
  open: boolean;
  /** 1-based index of the member step being processed */
  current: number;
  total: number;
  /** 0–100, animated */
  percent: number;
  /** e.g. "Processing member 3/12" */
  statusLine: string;
  /** Short label under the ring (e.g. "members") */
  countCaption: string;
  /** After 100%, show checkmark + label before overlay closes */
  safetyVerified?: boolean;
};

const R = 56;
const STROKE = 5;
const NR = R - STROKE / 2;
const CIRC = 2 * Math.PI * NR;

export function ProcessingOverlay({
  open,
  current,
  total,
  percent,
  statusLine,
  countCaption,
  safetyVerified = false,
}: ProcessingOverlayProps) {
  const spring = useSpring(0, { stiffness: 90, damping: 22, mass: 0.8 });
  const widthPct = useTransform(spring, (v) => `${Math.min(100, Math.max(0, v))}%`);
  const dashOffset = useTransform(spring, (v) => CIRC * (1 - Math.min(1, v / 100)));
  const [pctLabel, setPctLabel] = useState(0);

  useMotionValueEvent(spring, "change", (v) => {
    setPctLabel(Math.round(v));
  });

  useEffect(() => {
    spring.set(percent);
  }, [percent, spring]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="pdf-processing-overlay"
          role="status"
          aria-live="polite"
          aria-busy={!safetyVerified}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
        >
          <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-md" />
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="relative w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-sm"
          >
            <div className="relative mx-auto mb-6 h-36 w-36">
              <svg
                className="h-full w-full -rotate-90 text-slate-200"
                viewBox={`0 0 ${R * 2} ${R * 2}`}
                aria-hidden
              >
                <defs>
                  <linearGradient id="cg-ring-sheen" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgb(56 189 248)" stopOpacity="0" />
                    <stop offset="45%" stopColor="rgb(56 189 248)" stopOpacity="0.55" />
                    <stop offset="55%" stopColor="rgb(34 211 238)" stopOpacity="0.65" />
                    <stop offset="100%" stopColor="rgb(56 189 248)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <circle
                  cx={R}
                  cy={R}
                  r={NR}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={STROKE}
                />
                {!safetyVerified ? (
                  <motion.g
                    style={{ transformOrigin: `${R}px ${R}px` }}
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2.35, ease: "linear" }}
                  >
                    <circle
                      cx={R}
                      cy={R}
                      r={NR}
                      fill="none"
                      stroke="url(#cg-ring-sheen)"
                      strokeWidth={STROKE + 1}
                      strokeLinecap="round"
                      strokeDasharray={`${CIRC * 0.14} ${CIRC * 0.86}`}
                      strokeDashoffset={0}
                      opacity={0.9}
                    />
                  </motion.g>
                ) : null}
                <motion.circle
                  cx={R}
                  cy={R}
                  r={NR}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  className="text-of-500"
                  style={{ strokeDashoffset: dashOffset }}
                />
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <AnimatePresence mode="wait">
                  {safetyVerified ? (
                    <motion.div
                      key="verified"
                      className="flex flex-col items-center"
                      initial={{ opacity: 0, scale: 0.82 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 420, damping: 28 }}
                    >
                      <motion.svg
                        width="52"
                        height="52"
                        viewBox="0 0 52 52"
                        fill="none"
                        className="text-emerald-600"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.06 }}
                        aria-hidden
                      >
                        <circle cx="26" cy="26" r="24" stroke="currentColor" strokeWidth="2" opacity="0.35" />
                        <motion.path
                          d="M15 27l8 8 14-16"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{ pathLength: { duration: 0.45, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }}
                        />
                      </motion.svg>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="counts"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <span className="text-2xl font-bold tabular-nums text-slate-900">
                        {total > 0 ? Math.min(current, total) : 0}
                        <span className="text-slate-400">/</span>
                        {total}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {countCaption}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <p className="text-center text-sm font-medium text-slate-800">
              {statusLine}
            </p>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className="h-full rounded-full bg-of-500 shadow-sm"
                style={{ width: widthPct }}
              />
            </div>
            <p className="mt-2 text-center text-xs tabular-nums text-slate-500">
              {pctLabel}%
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
