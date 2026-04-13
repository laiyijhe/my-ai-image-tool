/** Shared limits and helpers for PDF protect (single + batch). */

import {
  extractMemberIdentityAndOptionalLabel,
  memberIdentityListsMatch,
  parseMemberIdentityListFromRaw,
} from "@/lib/member-identity";

export const PDF_PROTECT_MAX_BYTES = 50 * 1024 * 1024;

/** Max PDFs in one batch upload (single request). */
export const PDF_BATCH_MAX_FILES = 12;

/** Max distinct member identities per batch. */
export const PDF_BATCH_MAX_MEMBER_IDENTITIES = 15;

/** @deprecated Use PDF_BATCH_MAX_MEMBER_IDENTITIES */
export const PDF_BATCH_MAX_EMAILS = PDF_BATCH_MAX_MEMBER_IDENTITIES;

/** Max (file × identity) outputs — keeps Vercel within time/memory. */
export const PDF_BATCH_MAX_COMBOS = 24;

/** Client-side job cap when looping /api/protect/pdf. */
export const PDF_CLIENT_MAX_COMBOS = 50;

/**
 * Parse comma / newline / semicolon separated member identities; de-duplicate; keep order.
 * Supports `identity (GroupLabel)` per line or segment.
 */
export const parseEmailListFromRaw = parseMemberIdentityListFromRaw;

/**
 * Same recipients as a saved group (order-insensitive, case-insensitive on identity).
 */
export const emailListsMatch = memberIdentityListsMatch;

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
    const ex = extractMemberIdentityAndOptionalLabel(p);
    if (ex?.label) labels.add(ex.label);
  }
  if (labels.size !== 1) return null;
  return [...labels][0]!;
}

export function safePdfFileName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  const stem = (base.length > 0 ? base : "document").replace(/\.pdf$/i, "");
  return `creator-guard-${stem.slice(0, 80)}.pdf`;
}

/** Unique name inside a ZIP (index disambiguates duplicate stems). */
export function protectedPdfZipEntryName(
  originalName: string,
  memberIdentity: string,
  index: number
): string {
  const base = originalName
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const stem = (base.length > 0 ? base : "document")
    .replace(/\.pdf$/i, "")
    .slice(0, 40);
  const idSlug = memberIdentity
    .replace(/@/g, "_at_")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 72);
  return `creator-guard-${String(index).padStart(3, "0")}-${stem}-${idSlug}.pdf`;
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
