import type { PortalMember } from "@/components/portal/portal-types";

function updatedScore(m: PortalMember): number {
  if (m.updatedAt) {
    const t = Date.parse(m.updatedAt);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

/**
 * Merge non-demo members from several sources. Same `identityId` keeps the row
 * with the latest `updated_at` (ties keep the first winning row, then local overwrites on strict `>`).
 */
export function mergeMembersByLatestIdentity(
  demoMembers: PortalMember[],
  ...manualPools: PortalMember[][]
): PortalMember[] {
  const demoIds = new Set(demoMembers.map((m) => m.id));
  const byIdentity = new Map<string, PortalMember>();

  const consider = (m: PortalMember) => {
    if (demoIds.has(m.id)) return;
    const key = m.identityId.trim();
    if (!key) return;
    const prev = byIdentity.get(key);
    if (!prev) {
      byIdentity.set(key, m);
      return;
    }
    const nt = updatedScore(m);
    const pt = updatedScore(prev);
    if (nt > pt) {
      byIdentity.set(key, m);
    }
  };

  for (const pool of manualPools) {
    for (const m of pool) consider(m);
  }

  return [...demoMembers, ...byIdentity.values()];
}
