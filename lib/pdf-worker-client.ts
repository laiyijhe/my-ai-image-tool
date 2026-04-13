"use client";

import type { PlanType } from "@/lib/plan-types";
import type {
  PdfWorkerRequest,
  PdfWorkerResponse,
} from "@/lib/workers/pdf-worker";

let worker: Worker | null = null;

function getPdfWorker(): Worker {
  if (typeof window === "undefined") {
    throw new Error("PDF worker is browser-only.");
  }
  if (!worker) {
    worker = new Worker(
      new URL("./workers/pdf-worker.ts", import.meta.url),
      { type: "module" }
    );
  }
  return worker;
}

/**
 * Protect a PDF off the main thread (pdf-lib inside a Web Worker).
 * Caller must validate member identity before calling.
 */
export function protectPdfBytesInWorker(
  pdfBytes: ArrayBuffer,
  buyerEmail: string,
  userId: string,
  planType?: PlanType
): Promise<ArrayBuffer> {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const w = getPdfWorker();
  const payload: PdfWorkerRequest = {
    type: "protect",
    id,
    pdfBytes,
    buyerEmail,
    userId,
    planType,
  };

  return new Promise((resolve, reject) => {
    const onMessage = (ev: MessageEvent<PdfWorkerResponse>) => {
      const data = ev.data;
      if (!data || data.id !== id) return;
      w.removeEventListener("message", onMessage);
      if (data.ok) {
        resolve(data.pdfBytes);
      } else {
        reject(new Error(data.message || data.code));
      }
    };
    w.addEventListener("message", onMessage);
    try {
      w.postMessage(payload, [pdfBytes]);
    } catch (e) {
      w.removeEventListener("message", onMessage);
      reject(e instanceof Error ? e : new Error("postMessage failed"));
    }
  });
}
