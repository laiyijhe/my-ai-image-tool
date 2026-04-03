/** Shared limits and helpers for PDF protect (single + batch). */

export const PDF_PROTECT_MAX_BYTES = 25 * 1024 * 1024;

/** Max PDFs in one batch upload (single request). */
export const PDF_BATCH_MAX_FILES = 12;

/** Max distinct emails per batch. */
export const PDF_BATCH_MAX_EMAILS = 15;

/** Max (file × email) outputs — keeps Vercel within time/memory. */
export const PDF_BATCH_MAX_COMBOS = 24;

/** Client-side job cap when looping /api/protect/pdf. */
export const PDF_CLIENT_MAX_COMBOS = 50;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse comma / newline / semicolon separated emails; de-duplicate; keep order.
 */
export function parseEmailListFromRaw(raw: string): string[] {
  const parts = raw
    .split(/[\n,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (!EMAIL_RE.test(p)) continue;
    const lower = p.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(p);
  }
  return out;
}

export function safePdfFileName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  const stem = (base.length > 0 ? base : "document").replace(/\.pdf$/i, "");
  return `creator-guard-${stem.slice(0, 80)}.pdf`;
}

/** Unique name inside a ZIP (index disambiguates duplicate stems). */
export function protectedPdfZipEntryName(
  originalName: string,
  email: string,
  index: number
): string {
  const base = originalName
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const stem = (base.length > 0 ? base : "document")
    .replace(/\.pdf$/i, "")
    .slice(0, 40);
  const emailSlug = email
    .replace(/@/g, "_at_")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 72);
  return `creator-guard-${String(index).padStart(3, "0")}-${stem}-${emailSlug}.pdf`;
}

export function isPdfFileLike(file: File): boolean {
  if (file.size > PDF_PROTECT_MAX_BYTES) return false;
  if (
    file.type &&
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    return false;
  }
  return true;
}
