"use client";

import { writeCgBatchQueueFromSelection } from "@/lib/cg-batch-queue";
import { mergeMembersByLatestIdentity } from "@/lib/portal-cloud-merge";
import {
  isManualPortalMemberId,
  loadManualPortalMembers,
  persistManualPortalMembers,
  runOneTimeLegacyMembersCloudMigration,
} from "@/lib/portal-manual-members-storage";
import { publishCloudSync, subscribeCloudSync } from "@/lib/portal-sync-bus";
import { useCreatorPlan } from "@/hooks/useCreatorPlan";
import { useGroups } from "@/hooks/useGroups";
import {
  countQuotaEligibleMembers,
  isAtFreeMemberLimit,
} from "@/lib/member-quota";
import { isPaidPlan } from "@/lib/plan-types";
import { useSupabaseAuth } from "@/lib/supabase-auth-context";
import {
  fetchMembersFromCloud,
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  isUuidString,
} from "@/lib/supabase-client";
import { deleteGroupRow, insertGroupRow } from "@/lib/supabase-groups";
import { Navbar } from "@/components/navigation/Navbar";
import { Sidebar } from "@/components/navigation/Sidebar";
import { useLanguage } from "@/lib/i18n/language-context";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DragEvent } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActionBar } from "./ActionBar";
import { AddMemberModal, type AddMemberFormValues } from "./AddMemberModal";
import { UpgradeToProModal } from "./UpgradeToProModal";
import { MemberSwiper } from "./MemberSwiper";
import { MemberTable } from "./MemberTable";
import {
  GROUP_AUTHORIZED,
  GROUP_IGNORED,
  type PortalMember,
  type PortalViewMode,
} from "./portal-types";
import {
  memberMatchesSearch,
  mergeUniqueStrings,
  newPortalId,
  portalMemberDateToday,
  replacePortalTpl,
} from "./portal-utils";
import { savePortalCustomGroups } from "@/lib/portal-custom-groups-storage";
import { PORTAL_MOCK_MEMBERS } from "@/lib/portal-seed-members";

function CloudSyncStatusPill({
  state,
  labels,
}: {
  state: "offline" | "syncing" | "ok" | "error";
  labels: {
    offline: string;
    busy: string;
    ok: string;
    error: string;
  };
}) {
  const title =
    state === "offline"
      ? labels.offline
      : state === "syncing"
        ? labels.busy
        : state === "ok"
          ? labels.ok
          : labels.error;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
        state === "ok"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm"
          : state === "error"
            ? "border-rose-200 bg-rose-50 text-rose-900"
            : "border-slate-100 bg-slate-50 text-ink-muted"
      }`}
      title={title}
      aria-label={title}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`shrink-0 ${
          state === "ok"
            ? "text-emerald-600"
            : state === "error"
              ? "text-rose-600"
              : "text-ink-muted"
        }`}
        aria-hidden
      >
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      </svg>
      {state === "syncing" ? (
        <span
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-of-500/25 border-t-of-500"
          aria-hidden
        />
      ) : state === "ok" ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-600"
          aria-hidden
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : state === "error" ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          className="text-rose-600"
          aria-hidden
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      ) : (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
          —
        </span>
      )}
    </div>
  );
}

function GroupedMemberCard({ member }: { member: PortalMember }) {
  return (
    <motion.div layout layoutId={`grouped-${member.id}`} className="w-full">
      <div
        draggable
        onDragStart={(e: DragEvent<HTMLDivElement>) => {
          e.dataTransfer.setData("application/x-cg-contact", member.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        className="cursor-grab rounded-xl border border-slate-100 bg-white px-3 py-2 text-left text-sm text-ink shadow-sm active:cursor-grabbing"
      >
        <p className="truncate font-mono text-xs text-of-700">
          {member.identityId}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-ink-muted">
          {member.source} · {member.date}
        </p>
      </div>
    </motion.div>
  );
}

export default function TaiwanPortalPage() {
  const { t, locale } = useLanguage();
  const { user } = useSupabaseAuth();
  const {
    customGroups,
    setCustomGroups,
    beginGroupWrite,
    endGroupWrite,
  } = useGroups();
  const { planType, loading: planLoading } = useCreatorPlan();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<PortalViewMode>("swipe");
  const [searchQuery, setSearchQuery] = useState("");
  const [members, setMembers] = useState<PortalMember[]>(() => {
    const manual = loadManualPortalMembers();
    const demoIds = new Set(PORTAL_MOCK_MEMBERS.map((m) => m.id));
    const merged: PortalMember[] = [...PORTAL_MOCK_MEMBERS];
    for (const m of manual) {
      if (!demoIds.has(m.id)) merged.push(m);
    }
    return merged;
  });
  const [newGroupName, setNewGroupName] = useState("");
  const [dropHighlight, setDropHighlight] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkSelectedGroupIds, setBulkSelectedGroupIds] = useState<string[]>(
    () => []
  );
  const [unassignedListFilter, setUnassignedListFilter] = useState(false);
  const lastClickedRowIndexRef = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const cloudToastTimer = useRef<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cloudToast, setCloudToast] = useState<string | null>(null);
  const [cloudSyncBadge, setCloudSyncBadge] = useState<
    "offline" | "syncing" | "ok" | "error"
  >("offline");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [highlightMemberId, setHighlightMemberId] = useState<string | null>(
    null
  );
  const highlightRowTimer = useRef<number | null>(null);

  useEffect(() => {
    persistManualPortalMembers(members);
  }, [members]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      queueMicrotask(() => setCloudSyncBadge("offline"));
      return;
    }
    if (!user?.id) {
      queueMicrotask(() => setCloudSyncBadge("offline"));
      return;
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      queueMicrotask(() => setCloudSyncBadge("offline"));
      return;
    }
    const uid = user.id;
    let cancelled = false;
    queueMicrotask(() => setCloudSyncBadge("syncing"));
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
  }, [user?.id]);

  useEffect(() => {
    return subscribeCloudSync((d) => {
      if (!isSupabaseConfigured()) {
        setCloudSyncBadge("offline");
        return;
      }
      if (d.type === "started") {
        setCloudSyncBadge("syncing");
        return;
      }
      if (d.type === "failed") {
        setCloudSyncBadge("error");
        return;
      }
      if (d.type === "completed") {
        setCloudSyncBadge("ok");
        if (d.source === "persist") {
          if (cloudToastTimer.current) {
            window.clearTimeout(cloudToastTimer.current);
          }
          setCloudToast(t.portalCloudSyncToastOk);
          cloudToastTimer.current = window.setTimeout(() => {
            setCloudToast(null);
            cloudToastTimer.current = null;
          }, 2400);
        }
      }
    });
  }, [t]);

  useEffect(() => {
    return () => {
      if (highlightRowTimer.current) {
        window.clearTimeout(highlightRowTimer.current);
        highlightRowTimer.current = null;
      }
      if (cloudToastTimer.current) {
        window.clearTimeout(cloudToastTimer.current);
        cloudToastTimer.current = null;
      }
    };
  }, []);

  const pushToast = useCallback((msg: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3200);
  }, []);

  const groupOrder = useMemo(
    () => [GROUP_AUTHORIZED, GROUP_IGNORED, ...customGroups.map((g) => g.id)],
    [customGroups]
  );

  const groupLabel = useCallback(
    (gid: string) => {
      if (gid === GROUP_AUTHORIZED) return t.portalAuthorizedGroupName;
      if (gid === GROUP_IGNORED) return t.portalIgnoredGroupName;
      return customGroups.find((g) => g.id === gid)?.name ?? gid;
    },
    [customGroups, t]
  );

  const filteredMembers = useMemo(() => {
    let list = members.filter((m) => memberMatchesSearch(m, searchQuery));
    if (unassignedListFilter) {
      list = list.filter((m) => m.groupIds.length === 0);
    }
    return list;
  }, [members, searchQuery, unassignedListFilter]);

  const pendingDeck = useMemo(
    () => filteredMembers.filter((m) => m.groupIds.length === 0),
    [filteredMembers]
  );

  const groupOptions = useMemo(
    () =>
      groupOrder.map((id) => ({
        id,
        label: groupLabel(id),
      })),
    [groupOrder, groupLabel]
  );

  const addMemberInitialGroupOptions = useMemo(
    () => [
      { value: "", label: t.portalAddMemberPendingOption },
      { value: GROUP_AUTHORIZED, label: t.portalAuthorizedGroupName },
      { value: GROUP_IGNORED, label: t.portalIgnoredGroupName },
      ...customGroups.map((g) => ({ value: g.id, label: g.name })),
    ],
    [customGroups, t]
  );

  const countInGroup = useCallback(
    (gid: string) => members.filter((m) => m.groupIds.includes(gid)).length,
    [members]
  );

  const unassignedCount = useMemo(
    () => members.filter((m) => m.groupIds.length === 0).length,
    [members]
  );

  const quotaMemberCount = useMemo(
    () => countQuotaEligibleMembers(members),
    [members]
  );

  const openAddMemberFlow = useCallback(() => {
    if (isAtFreeMemberLimit(planType, quotaMemberCount)) {
      setUpgradeModalOpen(true);
      return;
    }
    setAddMemberOpen(true);
  }, [planType, quotaMemberCount]);

  const appendTagsToMembers = useCallback(
    (ids: Iterable<string>, tagsToAdd: string[]) => {
      const idSet = new Set(ids);
      const add = [...new Set(tagsToAdd.filter(Boolean))];
      if (idSet.size === 0 || add.length === 0) return;
      setMembers((prev) =>
        prev.map((m) =>
          idSet.has(m.id)
            ? { ...m, groupIds: mergeUniqueStrings(m.groupIds, add) }
            : m
        )
      );
      const names = add.map((g) => groupLabel(g)).join("、");
      pushToast(
        replacePortalTpl(t.portalMemberTagsAppliedToast, { groups: names })
      );
    },
    [groupLabel, pushToast, t]
  );

  const onSwipeTopCard = useCallback(
    (dir: "left" | "right") => {
      const top = pendingDeck[0];
      if (!top) return;
      const gid = dir === "right" ? GROUP_AUTHORIZED : GROUP_IGNORED;
      setMembers((prev) =>
        prev.map((m) =>
          m.id === top.id
            ? { ...m, groupIds: mergeUniqueStrings(m.groupIds, [gid]) }
            : m
        )
      );
      pushToast(
        dir === "right" ? t.portalToastAuthorized : t.portalToastIgnored
      );
    },
    [pendingDeck, pushToast, t]
  );

  const assignContactToGroup = useCallback(
    (memberId: string, groupId: string) => {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? { ...m, groupIds: mergeUniqueStrings(m.groupIds, [groupId]) }
            : m
        )
      );
      pushToast(
        replacePortalTpl(t.portalMemberMovedToast, {
          group: groupLabel(groupId),
        })
      );
    },
    [groupLabel, pushToast, t]
  );

  const handleToggleRow = useCallback(
    (memberId: string, rowIndex: number, shiftKey: boolean) => {
      if (shiftKey && lastClickedRowIndexRef.current !== null) {
        const a = Math.min(lastClickedRowIndexRef.current, rowIndex);
        const b = Math.max(lastClickedRowIndexRef.current, rowIndex);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (let i = a; i <= b; i++) {
            const id = filteredMembers[i]?.id;
            if (id) next.add(id);
          }
          return next;
        });
      } else {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(memberId)) next.delete(memberId);
          else next.add(memberId);
          return next;
        });
      }
      lastClickedRowIndexRef.current = rowIndex;
    },
    [filteredMembers]
  );

  const toggleSelectAllFiltered = useCallback(() => {
    const ids = filteredMembers.map((m) => m.id);
    const allOn =
      ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
    lastClickedRowIndexRef.current = null;
  }, [filteredMembers, selectedIds]);

  const toggleBulkGroup = useCallback((groupId: string) => {
    setBulkSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((g) => g !== groupId)
        : [...prev, groupId]
    );
  }, []);

  const applyBulkMove = useCallback(() => {
    if (bulkSelectedGroupIds.length === 0) return;
    appendTagsToMembers(selectedIds, bulkSelectedGroupIds);
    setSelectedIds(new Set());
    setBulkSelectedGroupIds([]);
    lastClickedRowIndexRef.current = null;
  }, [appendTagsToMembers, bulkSelectedGroupIds, selectedIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastClickedRowIndexRef.current = null;
  }, []);

  const handleBatchProtectPdf = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (!writeCgBatchQueueFromSelection(selectedIds, members)) return;
    setSelectedIds(new Set());
    lastClickedRowIndexRef.current = null;
    router.push(`/${locale}/protect/pdf`);
  }, [locale, members, router, selectedIds]);

  const handleQuickProtectPdf = useCallback(
    (memberId: string) => {
      const one = new Set([memberId]);
      if (!writeCgBatchQueueFromSelection(one, members)) return;
      router.push(`/${locale}/protect/pdf`);
    },
    [locale, members, router]
  );

  const handleAddMemberSubmit = useCallback(
    (values: AddMemberFormValues) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : newPortalId("member");
      const newMember: PortalMember = {
        id,
        identityId: values.identityId,
        source: values.source.trim() || "—",
        date: portalMemberDateToday(),
        groupIds: [...new Set(values.groupIds)],
      };
      setMembers((prev) => [newMember, ...prev]);
      pushToast(
        replacePortalTpl(t.portalAddMemberSuccessTpl, {
          id: values.identityId,
        })
      );
      if (highlightRowTimer.current) {
        window.clearTimeout(highlightRowTimer.current);
        highlightRowTimer.current = null;
      }
      setHighlightMemberId(viewMode === "list" ? id : null);
      if (viewMode === "list") {
        highlightRowTimer.current = window.setTimeout(() => {
          setHighlightMemberId(null);
          highlightRowTimer.current = null;
        }, 2600);
      }
    },
    [pushToast, t, viewMode]
  );

  const addCustomGroup = useCallback(async () => {
    const name = newGroupName.trim();
    if (!name) return;
    const client = getSupabaseBrowserClient();
    beginGroupWrite();
    try {
      if (user?.id && client && isSupabaseConfigured()) {
        const r = await insertGroupRow(client, user.id, name);
        if (r.ok) {
          setCustomGroups((g) => {
            if (g.some((x) => x.id === r.id)) return g;
            const next = [...g, { id: r.id, name }];
            savePortalCustomGroups(next);
            return next;
          });
          setNewGroupName("");
          return;
        }
        pushToast(
          t.portalCloudSyncError +
            (r.error ? ` — ${r.error}` : "")
        );
        return;
      }
      setCustomGroups((g) => {
        const next = [...g, { id: newPortalId("g"), name }];
        savePortalCustomGroups(next);
        return next;
      });
      setNewGroupName("");
    } finally {
      endGroupWrite();
    }
  }, [
    newGroupName,
    user,
    beginGroupWrite,
    endGroupWrite,
    setCustomGroups,
    pushToast,
    t.portalCloudSyncError,
  ]);

  const removeCustomGroup = useCallback(
    async (gid: string) => {
      const client = getSupabaseBrowserClient();
      beginGroupWrite();
      try {
        if (isUuidString(gid) && client) {
          const r = await deleteGroupRow(client, gid);
          if (!r.ok) {
            pushToast(
              t.portalCloudSyncError +
                (r.error ? ` — ${r.error}` : "")
            );
            return;
          }
        }
        setCustomGroups((g) => {
          const next = g.filter((x) => x.id !== gid);
          savePortalCustomGroups(next);
          return next;
        });
        setMembers((prev) =>
          prev.map((m) => ({
            ...m,
            groupIds: m.groupIds.filter((x) => x !== gid),
          }))
        );
        pushToast(t.portalGroupDeletedToast);
      } finally {
        endGroupWrite();
      }
    },
    [
      pushToast,
      t.portalCloudSyncError,
      t.portalGroupDeletedToast,
      beginGroupWrite,
      endGroupWrite,
      setCustomGroups,
    ]
  );

  const CARD =
    "rounded-[1.75rem] border border-slate-100 bg-white shadow-sm";

  const selectedCount = selectedIds.size;
  const padBottom = selectedCount > 0 ? "pb-44 sm:pb-40" : "pb-24";

  return (
    <div className="relative min-h-screen bg-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,175,240,0.08),transparent)]" />

      <div
        className={`relative mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12 ${padBottom} xl:grid xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start xl:gap-8`}
      >
        <div className="col-span-full">
          <Navbar lang={locale} surface="light" />
        </div>

        {user && !planLoading ? (
          isPaidPlan(planType) ? (
            <div className="col-span-full mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-gradient-to-r from-violet-50 via-fuchsia-50 to-white px-4 py-2.5 text-sm text-violet-900 shadow-sm ring-1 ring-of-500/10">
              <span className="text-base" aria-hidden>
                💎
              </span>
              <span className="font-medium">{t.portalPremiumRibbon}</span>
            </div>
          ) : (
            <div className="col-span-full mb-6 flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
              <span>{t.portalFreePlanRibbon}</span>
              <Link
                href={`/${locale}/pricing`}
                className="shrink-0 font-semibold text-of-600 underline-offset-4 hover:text-of-700 hover:underline"
              >
                {t.portalUpgradeCta}
              </Link>
            </div>
          )
        ) : null}

        <div className="min-w-0">
          <header className="mb-8 flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Link
                  href="/zh-TW"
                  className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  {t.portalBackHome}
                </Link>
                <Link
                  href={`/${locale}/verify`}
                  className="text-xs font-medium text-ink-muted underline-offset-4 transition hover:text-ink hover:underline sm:text-sm"
                >
                  {t.portalJumpToVerify}
                </Link>
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {t.portalWorkspaceTitle}
              </h1>
              <p className="mt-2 text-sm text-ink-muted">
                {t.portalImportMockHint}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-start sm:gap-3">
              <CloudSyncStatusPill
                state={cloudSyncBadge}
                labels={{
                  offline: t.portalCloudSyncOffline,
                  busy: t.portalCloudSyncBusy,
                  ok: t.portalCloudSyncOk,
                  error: t.portalCloudSyncError,
                }}
              />
              <button
                type="button"
                data-cg-portal="add-member"
                aria-label={t.portalAddMemberFabAria}
                onClick={() => openAddMemberFlow()}
                className="rounded-xl border border-of-500/35 bg-of-500/10 px-4 py-2.5 text-sm font-semibold text-of-700 shadow-sm transition hover:border-of-500/50 hover:bg-of-500/15"
              >
                ＋ {t.portalAddMemberTitle}
              </button>
            </div>
          </header>

          {toast ? (
            <div
              className="fixed bottom-24 left-1/2 z-[100] w-[min(100%-2rem,22rem)] -translate-x-1/2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-900 shadow-lg sm:bottom-28"
              role="status"
            >
              {toast}
            </div>
          ) : null}

          {cloudToast ? (
            <div
              className="fixed bottom-[5.5rem] left-1/2 z-[100] w-[min(100%-2rem,18rem)] -translate-x-1/2 rounded-xl border border-slate-100 bg-white px-3 py-2 text-center text-xs text-ink-muted shadow-sm sm:bottom-32"
              role="status"
            >
              {cloudToast}
            </div>
          ) : null}

          <div className={`${CARD} mb-6 p-4 sm:p-5`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div
                className="inline-flex rounded-xl border border-slate-100 bg-slate-50 p-1"
                role="tablist"
                aria-label="View mode"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "swipe"}
                  onClick={() => setViewMode("swipe")}
                  className={`relative rounded-lg px-4 py-2 text-sm font-medium transition ${
                    viewMode === "swipe"
                      ? "border border-of-500/40 bg-of-500/10 text-of-700 shadow-sm ring-2 ring-of-500/30 ring-offset-2 ring-offset-white"
                      : "border border-transparent text-ink-muted hover:text-ink"
                  }`}
                >
                  {viewMode === "swipe" ? (
                    <span
                      className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-t from-of-500/5 to-transparent"
                      aria-hidden
                    />
                  ) : null}
                  <span className="relative">{t.portalViewModeSwipe}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === "list"}
                  onClick={() => setViewMode("list")}
                  className={`relative rounded-lg px-4 py-2 text-sm font-medium transition ${
                    viewMode === "list"
                      ? "border border-of-500/40 bg-of-500/10 text-of-700 shadow-sm ring-2 ring-of-500/30 ring-offset-2 ring-offset-white"
                      : "border border-transparent text-ink-muted hover:text-ink"
                  }`}
                >
                  {viewMode === "list" ? (
                    <span
                      className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-t from-of-500/5 to-transparent"
                      aria-hidden
                    />
                  ) : null}
                  <span className="relative">{t.portalViewModeList}</span>
                </button>
              </div>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.portalSearchPlaceholder}
                className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:border-of-500/45 focus:outline-none focus:ring-2 focus:ring-of-500/15 sm:max-w-md"
              />
            </div>
          </div>

          <div className="relative mb-6 min-h-[min(28rem,70vh)]">
            <AnimatePresence mode="wait">
              {viewMode === "list" ? (
                <motion.section
                  key="portal-list"
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className={`${CARD} p-4 sm:p-5`}
                >
                  <h2 className="text-sm font-semibold text-ink">
                    {t.portalViewModeList}
                  </h2>
                  <p className="mt-1 text-xs text-ink-muted">
                    {t.portalListShiftHint}
                  </p>
                  <div className="mt-4">
                    <MemberTable
                      members={filteredMembers}
                      selectedIds={selectedIds}
                      onToggleRow={handleToggleRow}
                      onToggleSelectAllFiltered={toggleSelectAllFiltered}
                      resolveGroupLabel={groupLabel}
                      unassignedLabel={t.portalGroupUnassigned}
                      onQuickProtectPdf={handleQuickProtectPdf}
                      highlightMemberId={highlightMemberId}
                      labels={{
                        identity: t.portalContactIdentity,
                        source: t.portalContactSource,
                        date: t.portalContactDate,
                        group: t.portalTableGroupColumn,
                        actions: t.portalTableActionsColumn,
                        quickProtectPdf: t.portalQuickProtectPdf,
                        selectAllAria: t.portalSelectAllFilteredAria,
                      }}
                    />
                  </div>
                </motion.section>
              ) : (
                <motion.section
                  key="portal-swipe"
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className={`${CARD} p-4 sm:p-5`}
                >
                  <h2 className="text-sm font-semibold text-ink">
                    {t.portalSwiperTitle}
                  </h2>
                  <p className="mt-1 text-xs text-ink-muted">
                    {t.portalSwiperSubtitle}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-of-600">
                    {t.portalPendingReviewTitle}
                  </p>
                  <div className="mt-4">
                    <MemberSwiper
                      deck={pendingDeck}
                      onSwipe={onSwipeTopCard}
                      labels={{
                        identity: t.portalContactIdentity,
                        source: t.portalContactSource,
                        date: t.portalContactDate,
                        right: t.portalSwipeRightLabel,
                        left: t.portalSwipeLeftLabel,
                        empty: t.portalSwipeEmpty,
                      }}
                    />
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>

          <section className={`${CARD} p-4 sm:p-5`}>
            <h2 className="text-sm font-semibold text-ink">
              {t.portalGroupedSectionTitle}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              {t.portalGroupedSectionHint}
            </p>

            <LayoutGroup id="tw-portal-groups">
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groupOrder.map((gid) => (
                  <div
                    key={gid}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropHighlight(gid);
                    }}
                    onDragLeave={() => setDropHighlight(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDropHighlight(null);
                      const id = e.dataTransfer.getData(
                        "application/x-cg-contact"
                      );
                      if (id) assignContactToGroup(id, gid);
                    }}
                    className={`min-h-[10rem] rounded-2xl border border-dashed p-3 transition-colors ${
                      dropHighlight === gid
                        ? "border-of-400 bg-of-500/10"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                      {groupLabel(gid)}
                    </p>
                    <p className="mb-3 text-[11px] text-ink-muted">
                      {replacePortalTpl(t.portalMembersCountTpl, {
                        count: String(countInGroup(gid)),
                      })}
                    </p>
                    <div className="flex flex-col gap-2">
                      {members
                        .filter((m) => m.groupIds.includes(gid))
                        .map((m) => (
                          <GroupedMemberCard key={m.id} member={m} />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </LayoutGroup>
          </section>
        </div>

        <div className="mt-8 min-w-0 xl:mt-0">
          <Sidebar
            customGroups={customGroups}
            newGroupName={newGroupName}
            onNewGroupNameChange={setNewGroupName}
            onAddGroup={addCustomGroup}
            onRemoveGroup={removeCustomGroup}
            countInGroup={countInGroup}
            authorizedCount={countInGroup(GROUP_AUTHORIZED)}
            ignoredCount={countInGroup(GROUP_IGNORED)}
            unassignedCount={unassignedCount}
            unassignedFilterActive={unassignedListFilter}
            onToggleUnassignedFilter={() =>
              setUnassignedListFilter((v) => !v)
            }
            labels={{
              title: t.portalManageGroupsTitle,
              hint: t.portalManageGroupsHint,
              placeholder: t.portalNewGroupNamePlaceholder,
              add: t.portalAddGroup,
              removeAria: t.portalRemoveGroupAria,
              authorizedName: t.portalAuthorizedGroupName,
              ignoredName: t.portalIgnoredGroupName,
              membersCountTpl: t.portalMembersCountTpl,
              filterUnassigned: t.portalFilterUnassignedLabel,
              filterUnassignedAria: t.portalFilterUnassignedAria,
            }}
          />
        </div>
      </div>

      <UpgradeToProModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        pricingHref={`/${locale}/pricing`}
        labels={{
          title: t.portalUpgradeTitle,
          body: t.portalUpgradeBody,
          cta: t.portalUpgradeCta,
          dismiss: t.portalUpgradeLater,
        }}
      />

      <AddMemberModal
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        initialGroupOptions={addMemberInitialGroupOptions}
        onSubmit={handleAddMemberSubmit}
        labels={{
          title: t.portalAddMemberTitle,
          identity: t.portalAddMemberIdentity,
          identityPlaceholder: t.portalAddMemberIdentityPlaceholder,
          source: t.portalAddMemberSource,
          sourcePlaceholder: t.portalAddMemberSourcePlaceholder,
          initialGroup: t.portalAddMemberInitialGroup,
          submit: t.portalAddMemberSubmit,
          cancel: t.portalAddMemberCancel,
          errEmptyIdentity: t.portalAddMemberErrEmptyIdentity,
        }}
      />

      <ActionBar
        selectedCount={selectedCount}
        groupOptions={groupOptions}
        selectedGroupIds={bulkSelectedGroupIds}
        onToggleGroup={toggleBulkGroup}
        onApplyMove={applyBulkMove}
        onBatchProtectPdf={handleBatchProtectPdf}
        onClearSelection={clearSelection}
        labels={{
          countTpl: t.portalSelectedCountTpl,
          manageTagsLabel: t.portalActionManageTagsGroupsLabel,
          apply: t.portalActionApplyMove,
          clear: t.portalActionClearSelection,
          batchProtectPdf: t.portalActionBatchProtectPdf,
          clearAria: t.portalClearSelectionAria,
        }}
      />
    </div>
  );
}
