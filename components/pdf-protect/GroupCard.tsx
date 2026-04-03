"use client";

type GroupCardProps = {
  name: string;
  memberCount: number;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
};

export function GroupCard({
  name,
  memberCount,
  selected,
  onSelect,
  onDelete,
}: GroupCardProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition ${
        selected
          ? "border-sky-500/55 bg-sky-500/10 ring-1 ring-sky-400/30"
          : "border-slate-700/80 bg-slate-900/40 hover:border-slate-600"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-semibold text-slate-100">{name}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {memberCount} member{memberCount === 1 ? "" : "s"}
        </p>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="shrink-0 rounded-lg border border-slate-600/80 px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:border-red-500/40 hover:text-red-300"
        aria-label={`Delete preset ${name}`}
      >
        Delete
      </button>
    </div>
  );
}
