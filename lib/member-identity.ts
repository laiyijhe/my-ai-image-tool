/**
 * Generic member identity for embedding / batching (not limited to email).
 * 1–64 chars, no ASCII control characters (incl. newlines).
 */

export const MEMBER_IDENTITY_MAX_LEN = 64;

/** Resend / SMTP delivery still requires a real address. */
const DELIVERY_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidMemberIdentityToken(s: string): boolean {
  const t = s.trim();
  if (t.length < 1 || t.length > MEMBER_IDENTITY_MAX_LEN) return false;
  if (/[\r\n\t]/.test(t)) return false;
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (c < 32 || c === 127) return false;
  }
  return true;
}

export function isValidDeliveryEmail(s: string): boolean {
  const t = s.trim();
  return t.length > 0 && DELIVERY_EMAIL_RE.test(t);
}

export function extractMemberIdentityAndOptionalLabel(
  segment: string
): { identity: string; label?: string } | null {
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
  if (!isValidMemberIdentityToken(core)) return null;
  return { identity: core.trim(), label };
}

export function parseMemberIdentityListFromRaw(raw: string): string[] {
  const parts = raw
    .split(/[\n,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const ex = extractMemberIdentityAndOptionalLabel(p);
    if (!ex) continue;
    const key = ex.identity.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ex.identity);
  }
  return out;
}

export function memberIdentityListsMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const norm = (xs: string[]) =>
    [...xs].map((e) => e.toLowerCase()).sort().join("\0");
  return norm(a) === norm(b);
}
