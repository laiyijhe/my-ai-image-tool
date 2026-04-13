export function replacePortalTpl(
  s: string,
  vars: Record<string, string>
): string {
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v);
  }
  return out;
}

export function newPortalId(prefix: string): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
    }
  } catch {
    /* ignore */
  }
  return `${prefix}-${Date.now().toString(36)}`;
}

/** Local `YYYY-MM-DD` for portal member rows. */
export function portalMemberDateToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export function mergeUniqueStrings(
  existing: string[],
  toAdd: Iterable<string>
): string[] {
  const next = new Set(existing);
  for (const g of toAdd) next.add(g);
  return [...next];
}

/** Stable HSL colors for group badges from display label. */
export function portalGroupBadgeStyle(label: string): {
  background: string;
  borderColor: string;
  color: string;
} {
  let h = 0;
  for (let i = 0; i < label.length; i++) {
    h = (Math.imul(31, h) + label.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return {
    background: `hsla(${hue}, 55%, 94%, 0.98)`,
    borderColor: `hsla(${hue}, 45%, 78%, 0.95)`,
    color: `hsl(${hue}, 38%, 28%)`,
  };
}

export function memberMatchesSearch(
  m: { identityId: string; source: string; date: string },
  q: string
): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return (
    m.identityId.toLowerCase().includes(t) ||
    m.source.toLowerCase().includes(t) ||
    m.date.toLowerCase().includes(t)
  );
}
