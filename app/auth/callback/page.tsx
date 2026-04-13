"use client";

import {
  consumeOAuthReturnPathForVerify,
  redirectToAuthErrorPage,
} from "@/lib/supabase-auth-context";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase-client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;

    const safeReplace = (path: string) => {
      if (cancelled) return;
      try {
        router.replace(path);
      } catch {
        window.location.assign(path);
      }
    };

    const run = async () => {
      try {
        if (!isSupabaseConfigured()) {
          safeReplace(redirectToAuthErrorPage());
          return;
        }

        const client = getSupabaseBrowserClient();
        if (!client) {
          safeReplace(redirectToAuthErrorPage());
          return;
        }

        const code = searchParams.get("code");

        if (code) {
          const { error } = await client.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("exchangeCodeForSession", error.message);
            safeReplace(redirectToAuthErrorPage());
            return;
          }
        } else {
          const { data, error } = await client.auth.getSession();
          if (error) {
            console.error("getSession", error.message);
            safeReplace(redirectToAuthErrorPage());
            return;
          }
          if (!data.session) {
            safeReplace(redirectToAuthErrorPage());
            return;
          }
        }

        let verifyPath: string;
        try {
          verifyPath = consumeOAuthReturnPathForVerify();
        } catch (e) {
          console.error("consumeOAuthReturnPathForVerify", e);
          safeReplace(redirectToAuthErrorPage());
          return;
        }

        safeReplace(verifyPath);
      } catch (e) {
        console.error("auth/callback", e);
        safeReplace(redirectToAuthErrorPage());
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-300">
      <p className="text-sm">Signing in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
          …
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
