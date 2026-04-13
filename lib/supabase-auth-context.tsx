"use client";

import { isLocale } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/types";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";
import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const OAUTH_RETURN_KEY = "cg_oauth_return";

export type OAuthProviderId = "google" | "apple" | "facebook";

type SupabaseAuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** PKCE OAuth redirect; enable providers in Supabase (Google, Apple, Facebook, …). */
  signInWithOAuth: (provider: OAuthProviderId) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** Magic link / OTP to `email`; user completes sign-in from inbox. */
  signInWithEmailOtp: (email: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => Promise<void>;
  /** When Supabase env is missing, portal stays open and OAuth is hidden. */
  authAvailable: boolean;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | null>(
  null
);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const authAvailable = isSupabaseConfigured();

  useEffect(() => {
    if (!authAvailable) {
      setSession(null);
      setLoading(false);
      return;
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    void client.auth.getSession().then(({ data: { session: s } }) => {
      if (!cancelled) {
        setSession(s);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [authAvailable]);

  const signInWithOAuth = useCallback(
    async (provider: OAuthProviderId) => {
      if (typeof window === "undefined" || !authAvailable) return;
      const client = getSupabaseBrowserClient();
      if (!client) return;
      /* Clear prior session + PKCE verifier cookies/storage to avoid mismatch on a new OAuth round. */
      await client.auth.signOut().catch(() => {});
      try {
        sessionStorage.setItem(
          OAUTH_RETURN_KEY,
          `${window.location.pathname}${window.location.search}`
        );
      } catch {
        /* ignore */
      }
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await client.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) {
        console.error("signInWithOAuth", provider, error.message);
      }
    },
    [authAvailable]
  );

  const signInWithGoogle = useCallback(async () => {
    await signInWithOAuth("google");
  }, [signInWithOAuth]);

  const signInWithEmailOtp = useCallback(
    async (email: string) => {
      if (typeof window === "undefined" || !authAvailable) {
        return { ok: false as const, message: "Auth unavailable" };
      }
      const client = getSupabaseBrowserClient();
      if (!client) return { ok: false as const, message: "Auth unavailable" };
      const trimmed = email.trim();
      if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return { ok: false as const, message: "Invalid email" };
      }
      try {
        sessionStorage.setItem(
          OAUTH_RETURN_KEY,
          `${window.location.pathname}${window.location.search}`
        );
      } catch {
        /* ignore */
      }
      const emailRedirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await client.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo },
      });
      if (error) {
        return { ok: false as const, message: error.message };
      }
      return { ok: true as const };
    },
    [authAvailable]
  );

  const signOut = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    await client?.auth.signOut();
  }, []);

  const value = useMemo<SupabaseAuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signInWithOAuth,
      signInWithGoogle,
      signInWithEmailOtp,
      signOut,
      authAvailable,
    }),
    [
      session,
      loading,
      signInWithOAuth,
      signInWithGoogle,
      signInWithEmailOtp,
      signOut,
      authAvailable,
    ]
  );

  return (
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth(): SupabaseAuthContextValue {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) {
    throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider");
  }
  return ctx;
}

const DEFAULT_POST_AUTH_LOCALE: Locale = "zh-TW";

/** First path segment when it is a supported locale (e.g. `/en/portal` → `en`). */
export function localeFromStoredReturnPath(path: string | null): Locale {
  if (!path || !path.startsWith("/")) return DEFAULT_POST_AUTH_LOCALE;
  const seg = path.split("/").filter(Boolean)[0];
  if (seg && isLocale(seg)) return seg;
  return DEFAULT_POST_AUTH_LOCALE;
}

export function consumeOAuthReturnPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(OAUTH_RETURN_KEY);
    sessionStorage.removeItem(OAUTH_RETURN_KEY);
    return v && v.startsWith("/") ? v : null;
  } catch {
    return null;
  }
}

/** Clears the stored return path and yields `/{locale}/verify` for post-login navigation. */
export function consumeOAuthReturnPathForVerify(): string {
  if (typeof window === "undefined") {
    return `/${DEFAULT_POST_AUTH_LOCALE}/verify`;
  }
  const stored = consumeOAuthReturnPath();
  const locale = localeFromStoredReturnPath(stored);
  return `/${locale}/verify`;
}

/**
 * Use after a failed OAuth / callback. Peeks locale from the stored return path (if any), clears it,
 * and returns `/{locale}/auth-error` for `router.replace` / `location.assign`.
 */
export function redirectToAuthErrorPage(): string {
  if (typeof window === "undefined") {
    return `/${DEFAULT_POST_AUTH_LOCALE}/auth-error`;
  }
  let locale = DEFAULT_POST_AUTH_LOCALE;
  try {
    const v = sessionStorage.getItem(OAUTH_RETURN_KEY);
    if (v && v.startsWith("/")) {
      locale = localeFromStoredReturnPath(v);
    }
    sessionStorage.removeItem(OAUTH_RETURN_KEY);
  } catch {
    /* ignore */
  }
  return `/${locale}/auth-error`;
}
