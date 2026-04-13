"use client";

import {
  mergeUniqueStrings,
  newPortalId,
  portalMemberDateToday,
} from "@/components/portal/portal-utils";
import type { CustomGroup, PortalMember } from "@/components/portal/portal-types";
import { buildPortalEmailGroupsMap } from "@/lib/build-portal-email-groups-map";
import { mergeMembersByLatestIdentity } from "@/lib/portal-cloud-merge";
import {
  loadPortalCustomGroups,
  savePortalCustomGroups,
} from "@/lib/portal-custom-groups-storage";
import {
  isManualPortalMemberId,
  loadManualPortalMembers,
  persistManualPortalMembers,
  runOneTimeLegacyMembersCloudMigration,
} from "@/lib/portal-manual-members-storage";
import { PORTAL_MOCK_MEMBERS } from "@/lib/portal-seed-members";
import { publishCloudSync } from "@/lib/portal-sync-bus";
import { useLanguage } from "@/lib/i18n/language-context";
import { isValidDeliveryEmail } from "@/lib/member-identity";
import { useSupabaseAuth } from "@/lib/supabase-auth-context";
import {
  fetchMembersFromCloud,
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  syncMembersToCloud,
} from "@/lib/supabase-client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const PDF_MEMBER_SOURCE = "Creator Guard · PDF";

/**
 * Contact groups derived from the same portal members + custom groups as `/portal`,
 * with Supabase fetch when signed in (parity with Taiwan portal page).
 */
export function usePortalEmailGroups() {
  const { t } = useLanguage();
  const { user } = useSupabaseAuth();
  const [members, setMembers] = useState<PortalMember[]>([]);
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const skipCustomGroupPersist = useRef(true);

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
    const demoIds = new Set(PORTAL_MOCK_MEMBERS.map((m) => m.id));
    const merged: PortalMember[] = [...PORTAL_MOCK_MEMBERS];
    for (const m of manual) {
      if (!demoIds.has(m.id)) merged.push(m);
    }
    /* eslint-disable react-hooks/set-state-in-effect -- browser localStorage hydration before paint (portal parity) */
    setMembers(merged);
    setCustomGroups(loadPortalCustomGroups());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistManualPortalMembers(members);
  }, [members, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipCustomGroupPersist.current) {
      skipCustomGroupPersist.current = false;
      return;
    }
    savePortalCustomGroups(customGroups);
  }, [customGroups, hydrated]);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured() || !user?.id) return;
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
          PORTAL_MOCK_MEMBERS,
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
            PORTAL_MOCK_MEMBERS,
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
    (name: string, emails: string[]) => {
      const key = name.trim();
      const list = [
        ...new Set(
          emails
            .map((e) => e.trim())
            .filter((e) => e.length > 0 && isValidDeliveryEmail(e))
        ),
      ];
      if (!key || list.length === 0) return;

      setCustomGroups((prev) => {
        const existing = prev.find(
          (g) => g.name.trim().toLowerCase() === key.toLowerCase()
        );
        const newEntry: CustomGroup = existing ?? {
          id: newPortalId("g"),
          name: key,
        };
        const nextCg = existing ? prev : [...prev, newEntry];
        const gid = (existing ?? newEntry).id;

        setMembers((mPrev) => {
          let next = mPrev.map((m) => ({
            ...m,
            groupIds: m.groupIds.filter((x) => x !== gid),
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
                groupIds: mergeUniqueStrings(cur.groupIds, [gid]),
                updatedAt: new Date().toISOString(),
              };
            } else {
              const id =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : newPortalId("member");
              next = [
                {
                  id,
                  identityId: identity,
                  source: PDF_MEMBER_SOURCE,
                  date: portalMemberDateToday(),
                  groupIds: [gid],
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

        return nextCg;
      });
    },
    [pushCloud]
  );

  const removeGroup = useCallback(
    (name: string) => {
      const n = name.trim().toLowerCase();
      if (
        n === groupLabels.authorized.trim().toLowerCase() ||
        n === groupLabels.ignored.trim().toLowerCase() ||
        n === groupLabels.unassigned.trim().toLowerCase()
      ) {
        return;
      }

      setCustomGroups((prev) => {
        const g = prev.find((x) => x.name.trim().toLowerCase() === n);
        if (!g) return prev;
        const gid = g.id;

        setMembers((mPrev) => {
          const next = mPrev.map((m) => ({
            ...m,
            groupIds: m.groupIds.filter((x) => x !== gid),
          }));
          persistManualPortalMembers(next);
          pushCloud(next);
          return next;
        });

        return prev.filter((x) => x.id !== gid);
      });
    },
    [
      groupLabels.authorized,
      groupLabels.ignored,
      groupLabels.unassigned,
      pushCloud,
    ]
  );

  return { groups, hydrated, upsertGroup, removeGroup, sortedNames };
}
