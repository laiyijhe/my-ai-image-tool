"use client";

import { loadCgPresets } from "@/lib/cg-email-presets";
import {
  loadCgEmailGroups,
  saveCgEmailGroups,
  type CgEmailGroupsMap,
} from "@/lib/cg-email-groups";
import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Contact book: `{ "初級班": ["a@test.com"], "VIP": [...] }` in `localStorage` under `cg_email_groups`.
 */
export function useCgEmailGroups() {
  const [groups, setGroups] = useState<CgEmailGroupsMap>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let initial = loadCgEmailGroups();
    if (Object.keys(initial).length === 0) {
      const legacy = loadCgPresets();
      if (legacy.length > 0) {
        const merged: CgEmailGroupsMap = {};
        for (const p of legacy) {
          merged[p.name] = p.emails;
        }
        saveCgEmailGroups(merged);
        initial = merged;
      }
    }
    setGroups(initial);
    setHydrated(true);
  }, []);

  const upsertGroup = useCallback((name: string, emails: string[]) => {
    const key = name.trim();
    if (!key || emails.length === 0) return;
    setGroups((prev) => {
      const next = { ...prev, [key]: emails };
      saveCgEmailGroups(next);
      return next;
    });
  }, []);

  const removeGroup = useCallback((name: string) => {
    setGroups((prev) => {
      const next = { ...prev };
      delete next[name];
      saveCgEmailGroups(next);
      return next;
    });
  }, []);

  const sortedNames = useMemo(
    () =>
      Object.keys(groups).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      ),
    [groups]
  );

  return { groups, hydrated, upsertGroup, removeGroup, sortedNames };
}
