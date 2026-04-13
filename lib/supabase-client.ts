import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PortalMember } from "@/components/portal/portal-types";

let browserClient: SupabaseClient | null | undefined;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidString(id: string): boolean {
  return UUID_RE.test(id.trim());
}

/**
 * `public.members` columns (see `supabase/migrations/`).
 * `date` on {@link PortalMember} is derived from `updated_at` for display only.
 */
export type MembersTableRow = {
  id: string;
  user_id?: string;
  identity_id: string;
  source: string;
  group_ids: unknown;
  updated_at: string;
};

/** Payload for upsert (omit `id` to let Postgres assign a new uuid). */
export type MembersUpsertPayload = {
  id?: string;
  user_id: string;
  identity_id: string;
  source: string;
  group_ids: string[];
  updated_at: string;
};

function parseGroupIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

/**
 * Public anon client env (inlined on server and client by Next.js).
 * Use for Route Handlers / Server Components via {@link createSupabaseRouteHandlerClient}.
 */
export function getSupabasePublicEnv():
  | { url: string; anonKey: string }
  | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicEnv() !== null;
}

/**
 * Browser Supabase client. Returns null when env is missing or on the server.
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (browserClient !== undefined) return browserClient;

  const env = getSupabasePublicEnv();
  if (!env) {
    browserClient = null;
    return null;
  }

  try {
    browserClient = createClient(env.url, env.anonKey);
  } catch {
    browserClient = null;
  }
  return browserClient;
}

export function rowToPortalMember(row: MembersTableRow): PortalMember {
  const groupIds = parseGroupIds(row.group_ids);
  const iso = row.updated_at;
  const date =
    iso && !Number.isNaN(Date.parse(iso)) ? iso.slice(0, 10) : "";
  return {
    id: row.id,
    identityId: row.identity_id,
    source: row.source ?? "",
    date,
    groupIds: [...new Set(groupIds)],
    updatedAt: row.updated_at,
  };
}

export function portalMemberToUpsertRow(
  m: PortalMember,
  userId: string
): MembersUpsertPayload {
  const updated =
    m.updatedAt && !Number.isNaN(Date.parse(m.updatedAt))
      ? m.updatedAt
      : new Date().toISOString();
  const base: MembersUpsertPayload = {
    user_id: userId,
    identity_id: m.identityId.trim(),
    source: m.source,
    group_ids: m.groupIds,
    updated_at: updated,
  };
  if (isUuidString(m.id)) {
    base.id = m.id.trim();
  }
  return base;
}

/** @deprecated use {@link portalMemberToUpsertRow} with userId */
export function portalMemberToRow(
  m: PortalMember,
  userId: string
): MembersUpsertPayload {
  return portalMemberToUpsertRow(m, userId);
}

/** Fetch rows visible under RLS (authenticated user’s `members` only). */
export async function fetchMembersFromCloud(
  client: SupabaseClient
): Promise<{ ok: true; members: PortalMember[] } | { ok: false; error: string }> {
  try {
    const { data, error } = await client
      .from("members")
      .select("id, identity_id, source, group_ids, updated_at");

    if (error) {
      const code = "code" in error ? String((error as { code?: string }).code) : "";
      const hint =
        code === "PGRST205" ||
        /does not exist|schema cache|404/i.test(error.message)
          ? " — confirm `public.members` exists in Supabase (SQL editor) and retry."
          : "";
      return { ok: false, error: `${error.message}${hint}` };
    }
    const rows = (data ?? []) as MembersTableRow[];
    const members = rows.map((r) => rowToPortalMember(r));
    return { ok: true, members };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fetch failed",
    };
  }
}

/** Upsert portal members (RLS + `user_id` must match `auth.uid()`). */
export async function syncMembersToCloud(
  members: PortalMember[],
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getSupabaseBrowserClient();
  if (!client) {
    return { ok: false, error: "supabase_unconfigured" };
  }
  if (!userId) {
    return { ok: false, error: "auth_required" };
  }

  const rows = members.map((m) => portalMemberToUpsertRow(m, userId));
  if (rows.length === 0) {
    return { ok: true };
  }

  try {
    const { error } = await client.from("members").upsert(rows, {
      onConflict: "user_id,identity_id",
    });
    if (error) {
      const code = "code" in error ? String((error as { code?: string }).code) : "";
      const hint =
        code === "PGRST205" ||
        /does not exist|schema cache|404/i.test(error.message)
          ? " — confirm `public.members` exists and RLS allows insert/update."
          : "";
      return { ok: false, error: `${error.message}${hint}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "upsert failed",
    };
  }
}
