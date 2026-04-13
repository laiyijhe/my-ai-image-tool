"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { AuthModal } from "@/components/auth/AuthModal";

type AuthModalContextValue = {
  openAuthModal: () => void;
  closeAuthModal: () => void;
  authModalOpen: boolean;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openAuthModal = useCallback(() => setOpen(true), []);
  const closeAuthModal = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({
      openAuthModal,
      closeAuthModal,
      authModalOpen: open,
    }),
    [open, openAuthModal, closeAuthModal]
  );

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal open={open} onClose={closeAuthModal} />
    </AuthModalContext.Provider>
  );
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error("useAuthModal must be used within AuthModalProvider");
  }
  return ctx;
}
