import type { CustomGroup } from "@/components/portal/portal-types";

const KEY = "cg-portal-custom-groups";

function parse(raw: string | null): CustomGroup[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const out: CustomGroup[] = [];
    for (const item of v) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.name !== "string") continue;
      const name = o.name.trim();
      if (!name) continue;
      out.push({ id: o.id.trim(), name });
    }
    return out;
  } catch {
    return [];
  }
}

export function loadPortalCustomGroups(): CustomGroup[] {
  if (typeof window === "undefined") return [];
  return parse(localStorage.getItem(KEY));
}

export function savePortalCustomGroups(groups: CustomGroup[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(groups));
  } catch {
    /* ignore */
  }
}
