import type { SupabaseClient } from "@supabase/supabase-js";

export type GroupRow = { id: string; name: string };

export async function fetchGroupsFromCloud(
  client: SupabaseClient
): Promise<
  { ok: true; groups: GroupRow[] } | { ok: false; error: string }
> {
  try {
    const { data, error } = await client
      .from("groups")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      const code = "code" in error ? String((error as { code?: string }).code) : "";
      const hint =
        code === "PGRST205" ||
        /does not exist|schema cache|404/i.test(error.message)
          ? " — confirm `public.groups` exists in Supabase."
          : "";
      return { ok: false, error: `${error.message}${hint}` };
    }
    const rows = (data ?? []) as { id: string; name: string }[];
    return {
      ok: true,
      groups: rows.map((r) => ({
        id: String(r.id),
        name: String(r.name ?? "").trim(),
      })),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fetch groups failed",
    };
  }
}

export async function insertGroupRow(
  client: SupabaseClient,
  userId: string,
  name: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "empty_name" };
  try {
    const { data, error } = await client
      .from("groups")
      .insert({ user_id: userId, name: trimmed })
      .select("id")
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data?.id) return { ok: false, error: "no_id" };
    return { ok: true, id: String(data.id) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "insert failed",
    };
  }
}

export async function deleteGroupRow(
  client: SupabaseClient,
  groupId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await client.from("groups").delete().eq("id", groupId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "delete failed",
    };
  }
}
