import {
  GROUP_AUTHORIZED,
  GROUP_IGNORED,
  type CustomGroup,
  type PortalMember,
} from "@/components/portal/portal-types";
import { isValidDeliveryEmail } from "@/lib/member-identity";

export type PortalGroupLabels = {
  authorized: string;
  ignored: string;
  unassigned: string;
};

/**
 * Build `{ displayName -> email[] }` from portal members + custom group defs.
 * Only includes identities that pass {@link isValidDeliveryEmail}.
 */
export function buildPortalEmailGroupsMap(
  members: readonly PortalMember[],
  customGroups: readonly CustomGroup[],
  labels: PortalGroupLabels
): Record<string, string[]> {
  const idToLabel = new Map<string, string>();
  idToLabel.set(GROUP_AUTHORIZED, labels.authorized);
  idToLabel.set(GROUP_IGNORED, labels.ignored);
  for (const g of customGroups) {
    idToLabel.set(g.id, g.name.trim());
  }

  const map: Record<string, string[]> = {};

  const push = (label: string, email: string) => {
    const e = email.trim();
    if (!e || !isValidDeliveryEmail(e)) return;
    if (!map[label]) map[label] = [];
    if (!map[label].includes(e)) map[label].push(e);
  };

  for (const m of members) {
    const email = m.identityId.trim();
    if (!isValidDeliveryEmail(email)) continue;

    if (m.groupIds.length === 0) {
      push(labels.unassigned, email);
      continue;
    }

    for (const gid of m.groupIds) {
      const label = idToLabel.get(gid);
      if (label) push(label, email);
    }
  }

  return map;
}
