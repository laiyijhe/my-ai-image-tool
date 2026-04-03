import { parseEmailListFromRaw } from "@/lib/pdf-protect-shared";

export const CG_PRESETS_STORAGE_KEY = "cg_presets";

export type CgEmailPreset = {
  id: string;
  name: string;
  emails: string[];
};

function isValidPreset(x: unknown): x is CgEmailPreset {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    Array.isArray(o.emails) &&
    o.emails.every((e) => typeof e === "string")
  );
}

export function loadCgPresets(): CgEmailPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CG_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidPreset).map((p) => ({
      ...p,
      emails: parseEmailListFromRaw(p.emails.join("\n")),
    }));
  } catch {
    return [];
  }
}

export function saveCgPresets(presets: CgEmailPreset[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CG_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    /* quota / private mode */
  }
}

export function makePresetId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
