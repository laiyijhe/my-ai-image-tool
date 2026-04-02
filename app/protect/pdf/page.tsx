"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";

export default function PdfProtectPage() {
  const [file, setFile] = useState<File | null>(null);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))) {
      setFile(f);
      setError(null);
    } else {
      setError("Please drop a PDF file.");
    }
  }, []);

  const protect = async () => {
    setError(null);
    if (!file) {
      setError("Choose or drop a PDF first.");
      return;
    }
    const email = buyerEmail.trim();
    if (!email) {
      setError("Enter the buyer email.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("buyerEmail", email);

      const res = await fetch("/api/protect/pdf", {
        method: "POST",
        body: fd,
      });

      const mode = res.headers.get("X-Creator-Guard-Mode");
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(j?.message ?? `Request failed (${res.status})`);
      }

      if (mode !== "PDF-V1.0-STABLE") {
        console.warn("Unexpected X-Creator-Guard-Mode:", mode);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? "creator-guard-protected.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 px-4 py-12">
      <div>
        <Link
          href="/"
          className="text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
        >
          ← Creator Guard home
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          PDF Guard
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Double lock: footer license watermark + metadata (Author / Producer /
          hidden keywords). Drag a PDF, enter the buyer email, download the
          protected file.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-2xl border border-dashed border-slate-600 bg-slate-900/60 px-6 py-14 text-center transition hover:border-slate-500 hover:bg-slate-900"
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              setError(null);
            }
          }}
        />
        <p className="text-slate-200">
          {file ? file.name : "Drop PDF here or click to browse"}
        </p>
        <p className="mt-2 text-xs text-slate-500">Max 25 MB</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="buyerEmail" className="text-sm font-medium text-slate-300">
          Buyer email
        </label>
        <input
          id="buyerEmail"
          type="email"
          autoComplete="email"
          placeholder="buyer@example.com"
          value={buyerEmail}
          onChange={(e) => setBuyerEmail(e.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={loading}
        onClick={protect}
        className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Protecting…" : "Protect & download"}
      </button>
    </main>
  );
}
