import { parseEmailListFromRaw } from "@/lib/pdf-protect-shared";

export const CG_EMAIL_GROUPS_KEY = "cg_email_groups";

export type CgEmailGroupsMap = Record<string, string[]>;

export function loadCgEmailGroups(): CgEmailGroupsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CG_EMAIL_GROUPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: CgEmailGroupsMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const name = k.trim();
      if (!name) continue;
      if (!Array.isArray(v)) continue;
      const strings = v.filter((e): e is string => typeof e === "string");
      const cleaned = parseEmailListFromRaw(strings.join("\n"));
      if (cleaned.length > 0) out[name] = cleaned;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveCgEmailGroups(groups: CgEmailGroupsMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CG_EMAIL_GROUPS_KEY, JSON.stringify(groups));
  } catch {
    /* quota / private mode */
  }
}
