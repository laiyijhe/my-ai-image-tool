import type { PortalMember } from "@/components/portal/portal-types";
import { publishCloudSync } from "@/lib/portal-sync-bus";
import {
  getSupabaseBrowserClient,
  portalMemberToUpsertRow,
  rowToPortalMember,
  syncMembersToCloud,
  type MembersTableRow,
} from "@/lib/supabase-client";
import type { SupabaseClient } from "@supabase/supabase-js";

/** V5.3 portal manual members (browser persistence). */
export const CG_MEMBERS_STORAGE_KEY = "cg-members";

/** @deprecated read-only migration source */
const LEGACY_CG_PORTAL_MANUAL_MEMBERS_KEY = "cg_portal_manual_members";

/** @deprecated use {@link CG_MEMBERS_STORAGE_KEY} */
export const CG_PORTAL_MANUAL_MEMBERS_KEY = CG_MEMBERS_STORAGE_KEY;

/** Set after legacy `member-*` rows are upserted to Supabase (or none exist). */
const CLOUD_MIGRATION_DONE_KEY = "cg_supabase_members_migrated_v1";

const MANUAL_ID_PREFIX = "member-";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Manual / synced rows: legacy `member-*` or uuid ids (not built-in `demo-*` seeds). */
export function isManualPortalMemberId(id: string): boolean {
  const t = id.trim();
  if (/^demo-\d+$/i.test(t)) return false;
  return t.startsWith(MANUAL_ID_PREFIX) || UUID_RE.test(t);
}

export function normalizeManualPortalMember(x: unknown): PortalMember | null {
  if (x === null || typeof x !== "object") return null;
  const m = x as Record<string, unknown>;
  if (
    typeof m.id !== "string" ||
    !isManualPortalMemberId(m.id) ||
    typeof m.identityId !== "string" ||
    typeof m.source !== "string" ||
    typeof m.date !== "string"
  ) {
    return null;
  }
  let groupIds: string[] = [];
  if (
    Array.isArray(m.groupIds) &&
    m.groupIds.every((g): g is string => typeof g === "string")
  ) {
    groupIds = [...new Set(m.groupIds)];
  } else if (m.groupId === null || m.groupId === undefined) {
    groupIds = [];
  } else if (typeof m.groupId === "string") {
    groupIds = [m.groupId];
  } else {
    return null;
  }
  const updatedAt =
    typeof m.updatedAt === "string" && !Number.isNaN(Date.parse(m.updatedAt))
      ? m.updatedAt
      : undefined;
  return {
    id: m.id,
    identityId: m.identityId,
    source: m.source,
    date: m.date,
    groupIds,
    ...(updatedAt ? { updatedAt } : {}),
  };
}

function parseManualMembersJson(raw: string | null): PortalMember[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeManualPortalMember(item))
      .filter((m): m is PortalMember => m !== null);
  } catch {
    return [];
  }
}

export function loadManualPortalMembers(): PortalMember[] {
  if (typeof window === "undefined") return [];
  const primary = parseManualMembersJson(
    localStorage.getItem(CG_MEMBERS_STORAGE_KEY)
  );
  if (primary.length > 0) return primary;
  const legacy = parseManualMembersJson(
    localStorage.getItem(LEGACY_CG_PORTAL_MANUAL_MEMBERS_KEY)
  );
  if (legacy.length > 0) {
    try {
      localStorage.setItem(
        CG_MEMBERS_STORAGE_KEY,
        JSON.stringify(legacy)
      );
    } catch {
      /* ignore */
    }
  }
  return legacy;
}

/**
 * One-time: upsert `member-*` rows from localStorage (omit id → server uuid),
 * rewrite storage with returned rows. Clears PostgREST 404/upsert issues after schema deploy.
 */
export async function runOneTimeLegacyMembersCloudMigration(
  client: SupabaseClient,
  userId: string
): Promise<{ didWrite: boolean; error?: string }> {
  if (!userId) return { didWrite: false };
  if (typeof window === "undefined") return { didWrite: false };

  let already: string | null = null;
  try {
    already = localStorage.getItem(CLOUD_MIGRATION_DONE_KEY);
  } catch {
    return { didWrite: false };
  }
  if (already === "1") return { didWrite: false };

  const locals = loadManualPortalMembers();
  const legacy = locals.filter((m) => m.id.startsWith(MANUAL_ID_PREFIX));

  if (legacy.length === 0) {
    try {
      localStorage.setItem(CLOUD_MIGRATION_DONE_KEY, "1");
    } catch {
      /* ignore */
    }
    return { didWrite: false };
  }

  const rows = legacy.map((m) => portalMemberToUpsertRow(m, userId));
  const { data, error } = await client
    .from("members")
    .upsert(rows, { onConflict: "user_id,identity_id" })
    .select("id, identity_id, source, group_ids, updated_at");

  if (error) {
    return { didWrite: false, error: error.message };
  }

  const promoted = (data ?? []).map((row) =>
    rowToPortalMember(row as MembersTableRow)
  );
  const byIdentity = new Map<string, PortalMember>();
  for (const m of locals) {
    if (m.id.startsWith(MANUAL_ID_PREFIX)) continue;
    byIdentity.set(m.identityId.trim(), m);
  }
  for (const m of promoted) {
    byIdentity.set(m.identityId.trim(), m);
  }
  const next = [...byIdentity.values()];
  try {
    localStorage.setItem(CG_MEMBERS_STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem(CLOUD_MIGRATION_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
  return { didWrite: true };
}

export function persistManualPortalMembers(members: PortalMember[]): void {
  if (typeof window === "undefined") return;
  const manualRaw = members.filter((m) => isManualPortalMemberId(m.id));
  const iso = new Date().toISOString();
  const manual = manualRaw.map((m) => ({ ...m, updatedAt: iso }));
  try {
    localStorage.setItem(CG_MEMBERS_STORAGE_KEY, JSON.stringify(manual));
  } catch {
    /* ignore quota / private mode */
  }

  const client = getSupabaseBrowserClient();
  if (!client || manual.length === 0) return;

  void (async () => {
    const { data: authData } = await client.auth.getUser();
    const uid = authData.user?.id;
    if (!uid) return;

    publishCloudSync({ type: "started", source: "persist" });
    const r = await syncMembersToCloud(manual, uid);
    publishCloudSync(
      r.ok
        ? { type: "completed", source: "persist" }
        : { type: "failed", source: "persist", message: r.error }
    );
  })();
}
