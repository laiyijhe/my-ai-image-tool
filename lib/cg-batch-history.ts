export const CG_HISTORY_KEY = "cg_history";

export type CgBatchHistoryEntry = {
  emails: string[];
  at: string;
};

function normalizeKey(emails: string[]): string {
  return [...emails].map((e) => e.toLowerCase()).sort().join("|");
}

export function loadCgBatchHistory(): CgBatchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CG_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: CgBatchHistoryEntry[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      if (!Array.isArray(o.emails) || typeof o.at !== "string") continue;
      const emails = o.emails.filter((e): e is string => typeof e === "string");
      if (emails.length === 0) continue;
      out.push({ emails, at: o.at });
    }
    return out;
  } catch {
    return [];
  }
}

export function saveCgBatchHistory(entries: CgBatchHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CG_HISTORY_KEY, JSON.stringify(entries.slice(0, 50)));
  } catch {
    /* quota */
  }
}

/** Prepend this batch; de-dupe prior rows with the same email set; cap length. */
export function appendCgBatchHistory(emails: string[]): CgBatchHistoryEntry[] {
  if (emails.length === 0) return loadCgBatchHistory();
  const key = normalizeKey(emails);
  const prev = loadCgBatchHistory();
  const filtered = prev.filter(
    (e) => normalizeKey(e.emails) !== key
  );
  const next: CgBatchHistoryEntry[] = [
    { emails: [...emails], at: new Date().toISOString() },
    ...filtered,
  ].slice(0, 50);
  saveCgBatchHistory(next);
  return next;
}

export function topRecentHistory(
  entries: CgBatchHistoryEntry[],
  n: number
): CgBatchHistoryEntry[] {
  return entries.slice(0, n);
}
