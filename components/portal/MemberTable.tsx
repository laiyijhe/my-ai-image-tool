"use client";

import { useLayoutEffect, useRef } from "react";
import type { PortalMember } from "./portal-types";
import { portalGroupBadgeStyle } from "./portal-utils";

type MemberTableProps = {
  members: PortalMember[];
  selectedIds: ReadonlySet<string>;
  onToggleRow: (memberId: string, rowIndex: number, shiftKey: boolean) => void;
  onToggleSelectAllFiltered: () => void;
  resolveGroupLabel: (groupId: string) => string;
  unassignedLabel: string;
  onQuickProtectPdf: (memberId: string) => void;
  /** Briefly emphasize this row (e.g. after add-member). */
  highlightMemberId?: string | null;
  labels: {
    identity: string;
    source: string;
    date: string;
    group: string;
    actions: string;
    quickProtectPdf: string;
    selectAllAria: string;
  };
};

export function MemberTable({
  members,
  selectedIds,
  onToggleRow,
  onToggleSelectAllFiltered,
  resolveGroupLabel,
  unassignedLabel,
  onQuickProtectPdf,
  highlightMemberId,
  labels,
}: MemberTableProps) {
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  useLayoutEffect(() => {
    if (!highlightMemberId) return;
    const el = rowRefs.current.get(highlightMemberId);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightMemberId, members]);

  const allVisibleSelected =
    members.length > 0 && members.every((m) => selectedIds.has(m.id));
  const someVisibleSelected = members.some((m) => selectedIds.has(m.id));

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            <th className="w-10 px-3 py-3">
              <input
                type="checkbox"
                aria-label={labels.selectAllAria}
                checked={allVisibleSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                }}
                onChange={() => onToggleSelectAllFiltered()}
                className="h-4 w-4 rounded border-slate-300 bg-canvas text-of-500 focus:ring-of-500/40"
              />
            </th>
            <th className="px-3 py-3">{labels.identity}</th>
            <th className="px-3 py-3">{labels.source}</th>
            <th className="px-3 py-3">{labels.date}</th>
            <th className="min-w-[8rem] px-3 py-3">{labels.group}</th>
            <th className="w-28 px-3 py-3">{labels.actions}</th>
          </tr>
        </thead>
        <tbody>
          {members.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-10 text-center text-ink-muted"
              >
                —
              </td>
            </tr>
          ) : (
            members.map((m, index) => (
              <tr
                key={m.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(m.id, el);
                  else rowRefs.current.delete(m.id);
                }}
                className={`border-b border-slate-100 transition hover:bg-slate-50/80 ${
                  highlightMemberId === m.id
                    ? "bg-of-500/10 shadow-[inset_0_0_0_1px_rgba(0,175,240,0.35)] motion-safe:animate-pulse"
                    : ""
                }`}
              >
                <td className="px-3 py-2.5 align-middle">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(m.id)}
                    onClick={(e) => {
                      e.preventDefault();
                      onToggleRow(m.id, index, e.shiftKey);
                    }}
                    onChange={() => {}}
                    className="h-4 w-4 rounded border-slate-300 bg-canvas text-of-500 focus:ring-of-500/40"
                  />
                </td>
                <td className="max-w-[14rem] truncate px-3 py-2.5 font-mono text-xs text-of-700">
                  {m.identityId}
                </td>
                <td className="max-w-[10rem] truncate px-3 py-2.5 text-ink">
                  {m.source}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-ink-muted">
                  {m.date}
                </td>
                <td className="px-3 py-2.5 align-middle">
                  {m.groupIds.length === 0 ? (
                    <span className="text-xs text-ink-muted">{unassignedLabel}</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {m.groupIds.map((gid) => {
                        const name = resolveGroupLabel(gid);
                        const st = portalGroupBadgeStyle(name);
                        return (
                          <span
                            key={gid}
                            className="inline-block max-w-[7rem] truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-tight"
                            style={{
                              background: st.background,
                              borderColor: st.borderColor,
                              color: st.color,
                            }}
                            title={name}
                          >
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <button
                    type="button"
                    onClick={() => onQuickProtectPdf(m.id)}
                    className="rounded-lg border border-of-500/35 bg-of-500/10 px-2.5 py-1 text-[11px] font-semibold text-of-700 transition hover:border-of-500/50 hover:bg-of-500/15"
                  >
                    {labels.quickProtectPdf}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
