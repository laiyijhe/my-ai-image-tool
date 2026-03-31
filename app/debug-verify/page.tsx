"use client";

import { useEffect } from "react";

/**
 * Minimal verify harness — new route to avoid stale /verify bundles.
 * Vanilla DOM + fetch only (no Tailwind, no React state).
 */
export default function DebugVerifyPage() {
  useEffect(() => {
    const btn = document.getElementById("test-btn");
    const input = document.getElementById("file-input") as HTMLInputElement | null;
    if (!btn || !input) return;

    const onClick = async () => {
      const file = input.files?.[0];
      if (!file) {
        alert("NO_FILE_SELECTED");
        return;
      }
      const fd = new FormData();
      fd.set("file", file);
      try {
        const res = await fetch("/api/verify-v4", { method: "POST", body: fd });
        let data: unknown;
        try {
          data = await res.json();
        } catch {
          data = {
            parseError: true,
            httpStatus: res.status,
            statusText: res.statusText,
          };
        }
        console.log("debug-verify", res.status, data);
        alert(JSON.stringify(data));
      } catch (e) {
        console.error("debug-verify fetch error", e);
        alert(JSON.stringify({ fetchError: String(e) }));
      }
    };

    btn.addEventListener("click", onClick);
    return () => btn.removeEventListener("click", onClick);
  }, []);

  return (
    <main
      style={{
        padding: 32,
        fontFamily: "system-ui, sans-serif",
        maxWidth: 560,
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Debug verify</h1>
      <p style={{ fontSize: 14, color: "#444", marginBottom: 20 }}>
        Route <code>/debug-verify</code> — raw fetch to <code>/api/verify-v4</code>.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <input type="file" id="file-input" accept="image/*" />
        <button
          type="button"
          id="test-btn"
          style={{
            padding: "10px 18px",
            fontSize: 16,
            cursor: "pointer",
            background: "#0d9488",
            color: "#fff",
            border: "none",
            borderRadius: 8,
          }}
        >
          FORCE ANALYZE
        </button>
      </div>
    </main>
  );
}
