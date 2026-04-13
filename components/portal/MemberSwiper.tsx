"use client";

import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import type { PortalMember } from "./portal-types";

const SWIPE_THRESHOLD = 100;
const VELOCITY_MIN = 400;
const STACK_VISIBLE = 3;

type SwiperLabels = {
  identity: string;
  source: string;
  date: string;
  right: string;
  left: string;
  empty: string;
};

type MemberSwiperProps = {
  /** Pending members; deck[0] is interactive top card */
  deck: PortalMember[];
  onSwipe: (direction: "left" | "right") => void;
  labels: SwiperLabels;
};

function TopSwipeCard({
  member,
  onSwipe,
  labels,
}: {
  member: PortalMember;
  onSwipe: (d: "left" | "right") => void;
  labels: SwiperLabels;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const rightTint = useTransform(x, [40, 120], [0, 1]);
  const leftTint = useTransform(x, [-120, -40], [1, 0]);

  useEffect(() => {
    x.set(0);
  }, [member.id, x]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, x: 200 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      style={{ x, rotate, zIndex: 20 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.75}
      onDragEnd={(_e, info) => {
        const projected = info.offset.x + info.velocity.x * 0.15;
        if (projected > SWIPE_THRESHOLD || info.velocity.x > VELOCITY_MIN) {
          onSwipe("right");
        } else if (
          projected < -SWIPE_THRESHOLD ||
          info.velocity.x < -VELOCITY_MIN
        ) {
          onSwipe("left");
        }
        x.set(0);
      }}
      className="absolute left-0 right-0 top-0 mx-auto w-full max-w-sm cursor-grab rounded-2xl border border-slate-200 bg-canvas px-6 py-8 shadow-lg shadow-slate-200/60 active:cursor-grabbing"
    >
      <motion.div
        className="pointer-events-none absolute inset-x-4 top-4 flex justify-between text-[10px] font-bold uppercase tracking-widest"
        aria-hidden
      >
        <motion.span style={{ opacity: leftTint }} className="text-rose-600">
          {labels.left}
        </motion.span>
        <motion.span
          style={{ opacity: rightTint }}
          className="text-emerald-600"
        >
          {labels.right}
        </motion.span>
      </motion.div>
      <div className="pt-6">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
          {labels.identity}
        </p>
        <p className="mt-2 break-all font-mono text-lg font-semibold text-of-700">
          {member.identityId}
        </p>
        <div className="mt-6 grid gap-3 border-t border-slate-200 pt-5 text-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              {labels.source}
            </p>
            <p className="mt-1 text-ink">{member.source}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              {labels.date}
            </p>
            <p className="mt-1 font-mono text-ink-muted">{member.date}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function MemberSwiper({ deck, onSwipe, labels }: MemberSwiperProps) {
  if (deck.length === 0) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-canvas-subtle px-6 text-center text-sm text-ink-muted">
        {labels.empty}
      </div>
    );
  }

  const visible = deck.slice(0, STACK_VISIBLE);

  return (
    <div className="relative mx-auto min-h-[22rem] w-full max-w-md px-2 pt-4">
      <div className="relative mx-auto h-[19rem] w-full max-w-sm">
        {/* Back of stack (non-interactive) */}
        {visible.slice(1).map((member, idx) => {
          const depth = idx + 1;
          return (
            <div
              key={member.id}
              className="pointer-events-none absolute left-0 right-0 top-0 mx-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-canvas-subtle px-6 py-8 shadow-md"
              style={{
                zIndex: 20 - depth * 5,
                transform: `scale(${1 - depth * 0.045}) translateY(${depth * 10}px)`,
                opacity: 0.75 - depth * 0.12,
              }}
            >
              <p className="truncate font-mono text-sm text-of-600">
                {member.identityId}
              </p>
              <p className="mt-2 truncate text-xs text-ink-muted">
                {member.source} · {member.date}
              </p>
            </div>
          );
        })}

        <AnimatePresence mode="popLayout">
          {deck[0] ? (
            <TopSwipeCard
              key={deck[0].id}
              member={deck[0]}
              onSwipe={onSwipe}
              labels={labels}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
