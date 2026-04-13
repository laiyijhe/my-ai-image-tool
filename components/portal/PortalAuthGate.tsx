"use client";

import { useSupabaseAuth } from "@/lib/supabase-auth-context";
import { isSupabaseConfigured } from "@/lib/supabase-client";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 814 1000"
      width={16}
      height={20}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.5-297.5 251-397.4C384 57.6 472.3 0 544.9 0c69 0 127.1 41.1 163.1 41.1zM554.1 170.7c28.5-33.9 52.9-81.1 52.9-128.3 0-6.6-.6-13.2-1.9-18.5-49.4 2-108.7 33.7-141.8 76.3-26.2 32.9-50.6 81.1-50.6 129.1 0 7.5 1.3 15 1.9 17.3 3.2 1.3 8.7 1.9 13.8 1.9 42.2 0 91.1-28.6 126.7-77.5z"
      />
    </svg>
  );
}

export function PortalAuthGate({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const { session, loading, signInWithOAuth, authAvailable } =
    useSupabaseAuth();
  const [appleMaintenanceToast, setAppleMaintenanceToast] = useState(false);

  useEffect(() => {
    if (!appleMaintenanceToast) return;
    const id = window.setTimeout(() => setAppleMaintenanceToast(false), 4800);
    return () => window.clearTimeout(id);
  }, [appleMaintenanceToast]);

  const onAppleButtonClick = useCallback(() => {
    setAppleMaintenanceToast(true);
  }, []);

  if (!authAvailable || !isSupabaseConfigured()) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-canvas px-4">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-of-500/25 border-t-of-500" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-canvas">
        {appleMaintenanceToast ? (
          <div
            className="fixed bottom-6 left-1/2 z-[500] w-[min(100%-2rem,24rem)] -translate-x-1/2 transition-opacity duration-200"
            role="status"
            aria-live="polite"
          >
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-center text-sm font-medium leading-relaxed text-amber-950 shadow-lg shadow-amber-900/10">
              <p className="text-[13px] text-amber-900">
                {t.authAppleLoginMaintenance}
              </p>
            </div>
          </div>
        ) : null}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill-opacity='0.06' fill='%2394a3b8'%3E%3Cpath d='M0 0h40v40H0V0zm40 40h40v40H40V40z'/%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-md rounded-3xl border border-slate-200 bg-canvas p-8 text-center shadow-xl shadow-slate-200/60">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-of-500/25 bg-of-500/10 text-2xl text-of-600">
              🔒
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
              {t.authAccessDenied}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {t.authRestrictedHint}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void signInWithOAuth("google")}
                className="min-h-[44px] w-full rounded-2xl bg-of-500 py-3 text-sm font-bold text-white shadow-md shadow-of-500/25 transition hover:bg-of-600 active:scale-[0.99]"
              >
                {t.authLoginWithGoogle}
              </button>
              <button
                type="button"
                onClick={onAppleButtonClick}
                className="flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl bg-ink py-3 text-sm font-semibold tracking-tight text-white shadow-sm ring-1 ring-slate-900/10 transition hover:bg-slate-800 active:scale-[0.99]"
              >
                <AppleGlyph className="shrink-0 text-white" />
                {t.authLoginWithApple}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
