"use client";

import type { CustomGroup } from "./portal-types";
import { replacePortalTpl } from "./portal-utils";

type GroupSidePanelProps = {
  customGroups: CustomGroup[];
  newGroupName: string;
  onNewGroupNameChange: (v: string) => void;
  onAddGroup: () => void;
  onRemoveGroup: (id: string) => void;
  countInGroup: (groupId: string) => number;
  authorizedCount: number;
  ignoredCount: number;
  unassignedCount: number;
  unassignedFilterActive: boolean;
  onToggleUnassignedFilter: () => void;
  labels: {
    title: string;
    hint: string;
    placeholder: string;
    add: string;
    removeAria: string;
    authorizedName: string;
    ignoredName: string;
    membersCountTpl: string;
    filterUnassigned: string;
    filterUnassignedAria: string;
  };
};

export function GroupSidePanel({
  customGroups,
  newGroupName,
  onNewGroupNameChange,
  onAddGroup,
  onRemoveGroup,
  countInGroup,
  authorizedCount,
  ignoredCount,
  unassignedCount,
  unassignedFilterActive,
  onToggleUnassignedFilter,
  labels,
}: GroupSidePanelProps) {
  return (
    <aside
      className="rounded-[1.75rem] border border-slate-200 bg-canvas p-5 shadow-sm shadow-slate-200/50 lg:sticky lg:top-6 lg:self-start"
      aria-label={labels.title}
    >
      <h2 className="text-sm font-semibold text-ink">{labels.title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">{labels.hint}</p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={newGroupName}
          onChange={(e) => onNewGroupNameChange(e.target.value)}
          placeholder={labels.placeholder}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-canvas-subtle px-3 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:border-of-500/45 focus:outline-none focus:ring-2 focus:ring-of-500/15"
        />
        <button
          type="button"
          onClick={onAddGroup}
          className="rounded-xl bg-of-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-of-600"
        >
          {labels.add}
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        <li>
          <button
            type="button"
            aria-pressed={unassignedFilterActive}
            aria-label={labels.filterUnassignedAria}
            onClick={onToggleUnassignedFilter}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
              unassignedFilterActive
                ? "border-of-500/45 bg-of-500/10 text-of-700 shadow-sm ring-1 ring-of-500/20"
                : "border-slate-200 bg-canvas-subtle text-ink hover:border-slate-300 hover:bg-canvas"
            }`}
          >
            <span>{labels.filterUnassigned}</span>
            <span
              className={
                unassignedFilterActive
                  ? "text-xs font-medium text-of-500"
                  : "text-xs text-ink-muted"
              }
            >
              {replacePortalTpl(labels.membersCountTpl, {
                count: String(unassignedCount),
              })}
            </span>
          </button>
        </li>
        <li className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span>{labels.authorizedName}</span>
          <span className="text-xs font-medium text-emerald-600">
            {replacePortalTpl(labels.membersCountTpl, {
              count: String(authorizedCount),
            })}
          </span>
        </li>
        <li className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          <span>{labels.ignoredName}</span>
          <span className="text-xs font-medium text-rose-600">
            {replacePortalTpl(labels.membersCountTpl, {
              count: String(ignoredCount),
            })}
          </span>
        </li>
        {customGroups.map((g) => (
          <li
            key={g.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-canvas-subtle px-3 py-2 text-sm text-ink"
          >
            <span className="min-w-0 truncate">{g.name}</span>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-ink-muted">
                {replacePortalTpl(labels.membersCountTpl, {
                  count: String(countInGroup(g.id)),
                })}
              </span>
              <button
                type="button"
                aria-label={labels.removeAria}
                title={labels.removeAria}
                onClick={() => onRemoveGroup(g.id)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
