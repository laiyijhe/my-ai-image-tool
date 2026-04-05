"use client";

import type { SendMessagesParams } from "@liff/send-messages";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type LiffModule = typeof import("@line/liff").default;

export type LiffContextValue = {
  ready: boolean;
  initError: string | null;
  hasLiffId: boolean;
  isInClient: boolean;
  canUseShareTargetPicker: boolean;
  shareTargetPickerMessages: (messages: SendMessagesParams) => Promise<void>;
};

const LiffContext = createContext<LiffContextValue | null>(null);

export function LiffProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [isInClient, setIsInClient] = useState(false);
  const [liff, setLiff] = useState<LiffModule | null>(null);

  const liffId = useMemo(
    () => process.env.NEXT_PUBLIC_LIFF_ID?.trim() ?? "",
    []
  );
  const hasLiffId = Boolean(liffId);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const mod = await import("@line/liff");
        if (cancelled) return;
        const instance = mod.default;
        setLiff(instance);

        if (!liffId) {
          setReady(true);
          return;
        }

        await instance.init({ liffId });
        if (cancelled) return;
        setIsInClient(instance.isInClient());
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          setInitError(e instanceof Error ? e.message : "liff_init_failed");
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [liffId]);

  const canUseShareTargetPicker = useMemo(() => {
    if (!liff || !ready || !hasLiffId || initError) return false;
    return isInClient && liff.isApiAvailable("shareTargetPicker");
  }, [liff, ready, hasLiffId, initError, isInClient]);

  const shareTargetPickerMessages = useCallback(
    async (messages: SendMessagesParams) => {
      if (!liff) throw new Error("liff_not_loaded");
      if (!canUseShareTargetPicker) {
        throw new Error("shareTargetPicker_unavailable");
      }
      await liff.shareTargetPicker(messages);
    },
    [liff, canUseShareTargetPicker]
  );

  const value = useMemo<LiffContextValue>(
    () => ({
      ready,
      initError,
      hasLiffId,
      isInClient,
      canUseShareTargetPicker,
      shareTargetPickerMessages,
    }),
    [
      ready,
      initError,
      hasLiffId,
      isInClient,
      canUseShareTargetPicker,
      shareTargetPickerMessages,
    ]
  );

  return <LiffContext.Provider value={value}>{children}</LiffContext.Provider>;
}

export function useLiff(): LiffContextValue {
  const ctx = useContext(LiffContext);
  if (!ctx) {
    throw new Error("useLiff must be used within LiffProvider");
  }
  return ctx;
}
