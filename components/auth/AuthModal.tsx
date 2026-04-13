"use client";

import { useSupabaseAuth } from "@/lib/supabase-auth-context";
import { useLanguage } from "@/lib/i18n/language-context";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useId, useState } from "react";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
  );
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#00AFF0"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

const easeOut = [0.22, 1, 0.36, 1] as const;

const facebookAppId = process.env.NEXT_PUBLIC_AUTH_FACEBOOK_APP_ID ?? "";

function authRowMotion(delay: number) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.38, ease: easeOut },
  } as const;
}

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AuthModal({ open, onClose }: AuthModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <AuthModalContent key="cg-auth-modal" onClose={onClose} />
      ) : null}
    </AnimatePresence>
  );
}

function AuthModalContent({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const { signInWithOAuth, signInWithEmailOtp, authAvailable } =
    useSupabaseAuth();
  const titleId = useId();
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onBackdropMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const submitEmail = useCallback(async () => {
    setEmailMsg(null);
    setEmailBusy(true);
    const r = await signInWithEmailOtp(email);
    setEmailBusy(false);
    if (r.ok) {
      setEmailMsg(t.authModalEmailCheckInbox);
    } else {
      setEmailMsg(
        r.message === "Invalid email"
          ? t.authModalEmailInvalid
          : r.message
      );
    }
  }, [email, signInWithEmailOtp, t]);

  return (
    <motion.div
      className="fixed inset-0 z-[800] flex items-center justify-center bg-slate-900/20 p-3 backdrop-blur-[3px] sm:p-4"
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      onMouseDown={onBackdropMouseDown}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(92dvh,680px)] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl bg-canvas shadow-[0_24px_80px_rgba(15,23,42,0.2)] ring-1 ring-slate-200/80 sm:max-h-[min(90vh,640px)] sm:flex-row"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", damping: 26, stiffness: 320, mass: 0.85 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Left — single column on mobile; paired with gradient pane from sm+ */}
        <div className="flex min-h-0 w-full flex-col justify-center overflow-y-auto px-5 py-8 sm:w-[52%] sm:max-h-none sm:px-10 sm:py-10">
          <motion.div
            className="mb-6 flex items-center gap-2 sm:mb-8"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: easeOut, delay: 0.05 }}
          >
            <Image
              src="/favicon.svg"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10"
            />
            <span className="text-lg font-semibold tracking-tight text-ink">
              {t.brandName}
            </span>
          </motion.div>
          <motion.h2
            id={titleId}
            className="text-xl font-semibold tracking-tight text-ink sm:text-2xl sm:text-[1.65rem]"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: easeOut, delay: 0.08 }}
          >
            {t.authModalHeadline}
          </motion.h2>
          <motion.p
            className="mt-2 text-sm leading-relaxed text-ink-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.12 }}
          >
            {t.authModalSubline}
          </motion.p>

          <div className="mt-6 flex flex-col gap-3 sm:mt-8">
            {authAvailable ? (
              <>
                {/*
                  OAuth / magic link redirectTo stays on /auth/callback for the PKCE
                  exchange; AuthCallbackPage then navigates to /[lang]/verify.
                */}
                <motion.button
                  type="button"
                  {...authRowMotion(0.2)}
                  onClick={() => void signInWithOAuth("google")}
                  className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-canvas px-4 py-3 text-sm font-semibold text-ink shadow-sm transition hover:border-slate-300 hover:bg-canvas-subtle"
                >
                  <GoogleIcon className="h-5 w-5 shrink-0" />
                  {t.authModalContinueGoogle}
                </motion.button>
                <motion.button
                  type="button"
                  {...authRowMotion(0.3)}
                  onClick={() => void signInWithOAuth("facebook")}
                  data-cg-facebook-app-id={
                    facebookAppId ? facebookAppId : undefined
                  }
                  title={
                    facebookAppId
                      ? `Facebook · App ID ${facebookAppId} (OAuth via Supabase)`
                      : undefined
                  }
                  className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-of-500/25 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-of-500/10 transition hover:border-of-500/40 hover:bg-slate-50"
                >
                  <FacebookIcon className="h-5 w-5 shrink-0" />
                  {t.authModalContinueFacebook}
                </motion.button>
                {!emailMode ? (
                  <motion.button
                    type="button"
                    {...authRowMotion(0.4)}
                    onClick={() => setEmailMode(true)}
                    className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-canvas px-4 py-3 text-sm font-semibold text-ink shadow-sm transition hover:border-slate-300 hover:bg-canvas-subtle"
                  >
                    <EmailIcon className="h-5 w-5 shrink-0" />
                    {t.authModalContinueEmail}
                  </motion.button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: easeOut }}
                    className="rounded-xl border border-slate-200 bg-canvas-subtle p-4"
                  >
                    <label className="sr-only" htmlFor="cg-auth-email">
                      Email
                    </label>
                    <input
                      id="cg-auth-email"
                      type="email"
                      autoComplete="email"
                      placeholder={t.authModalEmailPlaceholder}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-canvas px-3 py-2.5 text-sm text-ink outline-none ring-of-500/20 placeholder:text-slate-400 focus:border-of-500 focus:ring-2"
                    />
                    <button
                      type="button"
                      disabled={emailBusy}
                      onClick={() => void submitEmail()}
                      className="mt-3 w-full rounded-lg bg-of-500 py-2.5 text-sm font-semibold text-white transition hover:bg-of-600 disabled:opacity-50"
                    >
                      {emailBusy ? "…" : t.authModalEmailSubmit}
                    </button>
                    {emailMsg ? (
                      <p className="mt-2 text-xs text-ink-muted">{emailMsg}</p>
                    ) : null}
                  </motion.div>
                )}
              </>
            ) : (
              <motion.p
                {...authRowMotion(0.2)}
                className="text-sm text-ink-muted"
              >
                {t.homeMemberPortalBlurb}
              </motion.p>
            )}
          </div>
        </div>

        {/* Right — desktop / tablet only */}
        <div className="relative hidden min-h-[280px] w-full sm:block sm:min-h-[420px] sm:w-[48%]">
          <div className="absolute inset-0 bg-gradient-to-br from-of-500 via-[#7c3aed] to-fuchsia-500" />
          <div
            className="absolute inset-0 opacity-40 mix-blend-soft-light"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, white, transparent 45%), radial-gradient(circle at 80% 70%, white, transparent 40%)",
            }}
          />
          <div className="absolute inset-0 flex flex-col justify-end p-8 text-white sm:p-10">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/80">
              Creator Guard
            </p>
            <p className="mt-2 max-w-xs text-2xl font-semibold leading-snug tracking-tight">
              {t.homeHeroCanvaTitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-2 text-ink-muted transition hover:bg-slate-100 hover:text-ink sm:right-4 sm:top-4"
          aria-label={t.authModalCloseAria}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </motion.div>
    </motion.div>
  );
}
