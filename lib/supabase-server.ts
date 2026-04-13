import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/lib/supabase-client";

/**
 * Supabase client for Route Handlers / Server Components with the user session from cookies.
 * Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (available server-side via Next env inlining).
 */
export async function createSupabaseRouteHandlerClient() {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are required.");
  }
  const { url, anonKey: anon } = env;

  const cookieStore = await cookies();

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* ignore when called from read-only context */
        }
      },
    },
  });
}
