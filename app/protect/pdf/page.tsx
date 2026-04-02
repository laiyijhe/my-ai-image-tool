"use client";

import Link from "next/link";
import { useState } from "react";

export default function PdfProtectPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    const buyerEmail = String(fd.get("buyerEmail") ?? "").trim();

    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a PDF file.");
      return;
    }
    if (!buyerEmail) {
      setError("Enter the buyer email.");
      return;
    }

    setLoading(true);
    try {
      const postFd = new FormData();
      postFd.set("file", file);
      postFd.set("buyerEmail", buyerEmail);

      const res = await fetch("/api/protect/pdf", {
        method: "POST",
        body: postFd,
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(j?.message ?? `Request failed (${res.status})`);
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
  }

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
          Upload a PDF, enter the buyer email, then download the protected file
          (footer watermark + document metadata).
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="pdf-file" className="text-sm font-medium text-slate-300">
            PDF file
          </label>
          <input
            id="pdf-file"
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            required
            className="text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100"
          />
          <p className="text-xs text-slate-500">Max 25 MB</p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="buyerEmail" className="text-sm font-medium text-slate-300">
            Buyer email
          </label>
          <input
            id="buyerEmail"
            name="buyerEmail"
            type="email"
            autoComplete="email"
            required
            placeholder="buyer@example.com"
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Protecting…" : "Protect & Download"}
        </button>
      </form>
    </main>
  );
}
