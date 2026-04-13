"use client";

import type { CustomGroup } from "@/components/portal/portal-types";
import {
  loadPortalCustomGroups,
  savePortalCustomGroups,
} from "@/lib/portal-custom-groups-storage";
import { useSupabaseAuth } from "@/lib/supabase-auth-context";
import { fetchGroupsFromCloud } from "@/lib/supabase-groups";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase-client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type GroupsSyncState = "idle" | "fetching" | "error";

/**
 * Shared `public.groups` state for portal + protect flows.
 * When signed in with Supabase configured, cloud is the source of truth (no initial localStorage flash).
 */
export function useGroups() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>([]);
  const [groupsHydrated, setGroupsHydrated] = useState(false);
  const [groupsSyncState, setGroupsSyncState] =
    useState<GroupsSyncState>("idle");
  const fetchGen = useRef(0);
  const outstandingWrites = useRef(0);

  const refetchGroupsFromCloud = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured()) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;

    const gen = ++fetchGen.current;
    setGroupsSyncState("fetching");

    const gr = await fetchGroupsFromCloud(client);
    if (gen !== fetchGen.current) return;

    if (gr.ok) {
      const mapped = gr.groups.map((g) => ({ id: g.id, name: g.name }));
      setCustomGroups(mapped);
      setGroupsSyncState("idle");
      try {
        savePortalCustomGroups(mapped);
      } catch {
        /* ignore */
      }
    } else {
      setGroupsSyncState("error");
    }
  }, [user?.id]);

  /** Resolve initial groups: local when offline / anonymous; cloud fetch when signed in. */
  useEffect(() => {
    if (authLoading) return;

    if (!user?.id || !isSupabaseConfigured()) {
      queueMicrotask(() => {
        setCustomGroups(loadPortalCustomGroups());
        setGroupsHydrated(true);
        setGroupsSyncState("idle");
      });
      return;
    }

    const client = getSupabaseBrowserClient();
    if (!client) {
      queueMicrotask(() => {
        setCustomGroups(loadPortalCustomGroups());
        setGroupsHydrated(true);
        setGroupsSyncState("idle");
      });
      return;
    }

    let cancelled = false;
    const gen = ++fetchGen.current;
    queueMicrotask(() => setGroupsSyncState("fetching"));

    void (async () => {
      const gr = await fetchGroupsFromCloud(client);
      if (cancelled || gen !== fetchGen.current) return;
      if (gr.ok) {
        const mapped = gr.groups.map((g) => ({ id: g.id, name: g.name }));
        setCustomGroups(mapped);
        try {
          savePortalCustomGroups(mapped);
        } catch {
          /* ignore */
        }
        setGroupsSyncState("idle");
      } else {
        setGroupsSyncState("error");
      }
      setGroupsHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const onFocus = () => {
      void refetchGroupsFromCloud();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void refetchGroupsFromCloud();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user?.id, refetchGroupsFromCloud]);

  /** Persist to localStorage only when not using cloud as source of truth. */
  useEffect(() => {
    if (!groupsHydrated) return;
    if (user?.id && isSupabaseConfigured()) return;
    savePortalCustomGroups(customGroups);
  }, [customGroups, groupsHydrated, user?.id]);

  const beginGroupWrite = useCallback(() => {
    outstandingWrites.current += 1;
  }, []);

  const endGroupWrite = useCallback(() => {
    outstandingWrites.current = Math.max(0, outstandingWrites.current - 1);
  }, []);

  useEffect(() => {
    const sync = () => outstandingWrites.current;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sync() > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return {
    customGroups,
    setCustomGroups,
    groupsHydrated,
    groupsSyncState,
    refetchGroupsFromCloud,
    beginGroupWrite,
    endGroupWrite,
  };
}
