"use client";

import {
  GROUP_AUTHORIZED,
  GROUP_IGNORED,
  type PortalMember,
} from "@/components/portal/portal-types";
import {
  mergeUniqueStrings,
  newPortalId,
  portalMemberDateToday,
} from "@/components/portal/portal-utils";
import { buildPortalEmailGroupsMap } from "@/lib/build-portal-email-groups-map";
import { mergeMembersByLatestIdentity } from "@/lib/portal-cloud-merge";
import { savePortalCustomGroups } from "@/lib/portal-custom-groups-storage";
import {
  isManualPortalMemberId,
  loadManualPortalMembers,
  persistManualPortalMembers,
  runOneTimeLegacyMembersCloudMigration,
} from "@/lib/portal-manual-members-storage";
import { publishCloudSync } from "@/lib/portal-sync-bus";
import { useLanguage } from "@/lib/i18n/language-context";
import { isValidDeliveryEmail } from "@/lib/member-identity";
import { useSupabaseAuth } from "@/lib/supabase-auth-context";
import {
  deleteGroupRow,
  insertGroupRow,
} from "@/lib/supabase-groups";
import {
  fetchMembersFromCloud,
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  isUuidString,
  syncMembersToCloud,
} from "@/lib/supabase-client";
import { useGroups } from "@/hooks/useGroups";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

const PDF_MEMBER_SOURCE = "Creator Guard · PDF";

/** Pseudo-id for the unassigned / pending bucket in the protect UI. */
export const PROTECT_UNASSIGNED_ID = "__cg_unassigned__";

export type ProtectGroupPick = {
  id: string;
  name: string;
  count: number;
};

/**
 * PDF protect: no demo members; custom groups via {@link useGroups} (Supabase when signed in).
 */
export function useProtectGroups() {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useSupabaseAuth();
  const {
    customGroups,
    setCustomGroups,
    groupsHydrated,
    groupsSyncState,
    refetchGroupsFromCloud,
    beginGroupWrite,
    endGroupWrite,
  } = useGroups();
  const [members, setMembers] = useState<PortalMember[]>([]);
  const [membersHydrated, setMembersHydrated] = useState(false);

  const groupLabels = useMemo(
    () => ({
      authorized: t.portalAuthorizedGroupName,
      ignored: t.portalIgnoredGroupName,
      unassigned: t.portalGroupUnassigned,
    }),
    [t]
  );

  useLayoutEffect(() => {
    const manual = loadManualPortalMembers();
    setMembers(mergeMembersByLatestIdentity([], manual, []));
    setMembersHydrated(true);
  }, []);

  const hydrated = membersHydrated && groupsHydrated;

  useEffect(() => {
    if (!hydrated) return;
    persistManualPortalMembers(members);
  }, [members, hydrated]);

  useEffect(() => {
    if (!hydrated || !user?.id || !isSupabaseConfigured()) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const uid = user.id;
    let cancelled = false;
    publishCloudSync({ type: "started", source: "fetch" });
    void (async () => {
      const r = await fetchMembersFromCloud(client);
      if (cancelled) return;
      if (!r.ok) {
        publishCloudSync({
          type: "failed",
          source: "fetch",
          message: r.error,
        });
        return;
      }
      setMembers((prev) =>
        mergeMembersByLatestIdentity(
          [],
          prev.filter((m) => isManualPortalMemberId(m.id)),
          r.members
        )
      );

      const mig = await runOneTimeLegacyMembersCloudMigration(client, uid);
      if (cancelled) return;
      if (mig.error) {
        publishCloudSync({
          type: "failed",
          source: "fetch",
          message: mig.error,
        });
        return;
      }
      if (mig.didWrite) {
        const r2 = await fetchMembersFromCloud(client);
        if (cancelled) return;
        if (!r2.ok) {
          publishCloudSync({
            type: "failed",
            source: "fetch",
            message: r2.error,
          });
          return;
        }
        setMembers(
          mergeMembersByLatestIdentity(
            [],
            loadManualPortalMembers(),
            r2.members
          )
        );
      }
      publishCloudSync({ type: "completed", source: "fetch" });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, hydrated]);

  const groups = useMemo(
    () => buildPortalEmailGroupsMap(members, customGroups, groupLabels),
    [members, customGroups, groupLabels]
  );

  const sortedNames = useMemo(
    () =>
      Object.keys(groups).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      ),
    [groups]
  );

  const idToName = useMemo(() => {
    const out: Record<string, string> = {};
    out[GROUP_AUTHORIZED] = groupLabels.authorized;
    out[GROUP_IGNORED] = groupLabels.ignored;
    out[PROTECT_UNASSIGNED_ID] = groupLabels.unassigned;
    for (const g of customGroups) {
      out[g.id] = g.name;
    }
    return out;
  }, [groupLabels, customGroups]);

  const sortedPickList = useMemo((): ProtectGroupPick[] => {
    const rows: ProtectGroupPick[] = [];
    for (const name of sortedNames) {
      let id = "";
      if (name === groupLabels.authorized) id = GROUP_AUTHORIZED;
      else if (name === groupLabels.ignored) id = GROUP_IGNORED;
      else if (name === groupLabels.unassigned) id = PROTECT_UNASSIGNED_ID;
      else {
        const cg = customGroups.find((g) => g.name === name);
        id = cg?.id ?? "";
      }
      if (!id) continue;
      rows.push({
        id,
        name,
        count: groups[name]?.length ?? 0,
      });
    }
    return rows.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }, [sortedNames, groupLabels, customGroups, groups]);

  const pushCloud = useCallback(
    (next: PortalMember[]) => {
      if (!user?.id) return;
      void syncMembersToCloud(
        next.filter((m) => isManualPortalMemberId(m.id)),
        user.id
      ).then((r) => {
        if (!r.ok) {
          publishCloudSync({
            type: "failed",
            source: "persist",
            message: r.error,
          });
        } else {
          publishCloudSync({ type: "completed", source: "persist" });
        }
      });
    },
    [user]
  );

  const upsertGroup = useCallback(
    async (name: string, emails: string[]): Promise<string | undefined> => {
      const key = name.trim();
      const list = [
        ...new Set(
          emails
            .map((e) => e.trim())
            .filter((e) => e.length > 0 && isValidDeliveryEmail(e))
        ),
      ];
      if (!key || list.length === 0) return undefined;

      const client = getSupabaseBrowserClient();
      beginGroupWrite();
      try {
        let gid: string | undefined;

        const existing = customGroups.find(
          (g) => g.name.trim().toLowerCase() === key.toLowerCase()
        );

        if (existing) {
          gid = existing.id;
        } else if (user?.id && client && isSupabaseConfigured()) {
          const ins = await insertGroupRow(client, user.id, key);
          if (!ins.ok) {
            publishCloudSync({
              type: "failed",
              source: "persist",
              message: ins.error,
            });
            return undefined;
          }
          gid = ins.id;
          setCustomGroups((prev) => {
            if (prev.some((g) => g.id === gid)) return prev;
            const next = [...prev, { id: gid!, name: key }];
            savePortalCustomGroups(next);
            return next;
          });
        } else {
          gid = newPortalId("g");
          setCustomGroups((prev) => {
            const next = [...prev, { id: gid!, name: key }];
            savePortalCustomGroups(next);
            return next;
          });
        }

        const finalGid = gid;
        if (!finalGid) return undefined;

        setMembers((mPrev) => {
          let next = mPrev.map((m) => ({
            ...m,
            groupIds: m.groupIds.filter((x) => x !== finalGid),
          }));

          for (const raw of list) {
            const identity = raw.trim();
            const lower = identity.toLowerCase();
            const idx = next.findIndex(
              (m) => m.identityId.trim().toLowerCase() === lower
            );
            if (idx >= 0) {
              const cur = next[idx]!;
              next[idx] = {
                ...cur,
                groupIds: mergeUniqueStrings(cur.groupIds, [finalGid]),
                updatedAt: new Date().toISOString(),
              };
            } else {
              const mid =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : newPortalId("member");
              next = [
                {
                  id: mid,
                  identityId: identity,
                  source: PDF_MEMBER_SOURCE,
                  date: portalMemberDateToday(),
                  groupIds: [finalGid],
                  updatedAt: new Date().toISOString(),
                },
                ...next,
              ];
            }
          }

          persistManualPortalMembers(next);
          pushCloud(next);
          return next;
        });

        return finalGid;
      } finally {
        endGroupWrite();
      }
    },
    [
      customGroups,
      pushCloud,
      user,
      setCustomGroups,
      beginGroupWrite,
      endGroupWrite,
    ]
  );

  const removeGroupById = useCallback(
    async (groupId: string) => {
      if (
        groupId === GROUP_AUTHORIZED ||
        groupId === GROUP_IGNORED ||
        groupId === PROTECT_UNASSIGNED_ID
      ) {
        return;
      }

      const client = getSupabaseBrowserClient();
      beginGroupWrite();
      try {
        if (isUuidString(groupId) && client) {
          const r = await deleteGroupRow(client, groupId);
          if (!r.ok) {
            publishCloudSync({
              type: "failed",
              source: "persist",
              message: r.error,
            });
            return;
          }
        }

        setCustomGroups((prev) => {
          const next = prev.filter((x) => x.id !== groupId);
          savePortalCustomGroups(next);
          return next;
        });

        setMembers((mPrev) => {
          const next = mPrev.map((m) => ({
            ...m,
            groupIds: m.groupIds.filter((x) => x !== groupId),
          }));
          persistManualPortalMembers(next);
          pushCloud(next);
          return next;
        });
      } finally {
        endGroupWrite();
      }
    },
    [pushCloud, setCustomGroups, beginGroupWrite, endGroupWrite]
  );

  return {
    groups,
    hydrated,
    sortedPickList,
    idToName,
    customGroups,
    upsertGroup,
    removeGroupById,
    groupsSyncState,
    refetchGroupsFromCloud,
    authLoading,
  };
}
