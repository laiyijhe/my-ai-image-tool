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
 * One token like `user@test.com` or `user@test.com (DogClass)`.
 */
export function extractEmailAndOptionalLabel(
  segment: string
): { email: string; label?: string } | null {
  const t = segment.trim();
  if (!t) return null;
  let core = t;
  let labelRaw: string | undefined;
  const spaced = t.match(/^(.+?)\s+\(([^)]*)\)\s*$/);
  if (spaced) {
    core = spaced[1]!.trim();
    labelRaw = spaced[2]?.trim();
  } else {
    const open = t.lastIndexOf("(");
    const close = t.lastIndexOf(")");
    if (open > 0 && close === t.length - 1 && close > open) {
      core = t.slice(0, open).trim();
      labelRaw = t.slice(open + 1, close).trim();
    }
  }
  const label =
    labelRaw && labelRaw.length > 0 ? labelRaw.slice(0, 120) : undefined;
  if (!EMAIL_RE.test(core)) return null;
  return { email: core, label };
}

/**
 * Parse comma / newline / semicolon separated emails; de-duplicate; keep order.
 * Supports `email (GroupLabel)` per line or segment.
 */
export function parseEmailListFromRaw(raw: string): string[] {
  const parts = raw
    .split(/[\n,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const ex = extractEmailAndOptionalLabel(p);
    if (!ex) continue;
    const lower = ex.email.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(ex.email);
  }
  return out;
}

/**
 * If every labeled segment shares one label (or only one distinct label appears), return it.
 */
export function suggestGroupLabelFromRaw(raw: string): string | null {
  const parts = raw
    .split(/[\n,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const labels = new Set<string>();
  for (const p of parts) {
    const ex = extractEmailAndOptionalLabel(p);
    if (ex?.label) labels.add(ex.label);
  }
  if (labels.size !== 1) return null;
  return [...labels][0]!;
}

/** Same recipients as a saved group (order-insensitive, case-insensitive on email). */
export function emailListsMatch(
  a: string[],
  b: string[]
): boolean {
  if (a.length !== b.length) return false;
  const norm = (xs: string[]) =>
    [...xs].map((e) => e.toLowerCase()).sort().join("\0");
  return norm(a) === norm(b);
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
