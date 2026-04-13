/// <reference lib="webworker" />

/**
 * Off–main-thread PDF stamping (pdf-lib). jsPDF is bundled for upcoming composite pipelines (V6+).
 */
import { jsPDF } from "jspdf";
import type { PlanType } from "../plan-types";
import {
  applyCreatorGuardToPdfBytes,
  CreatorGuardPdfCoreError,
} from "../pdf-guard-core";

void (typeof jsPDF === "function");

export type PdfWorkerRequest = {
  type: "protect";
  id: string;
  pdfBytes: ArrayBuffer;
  buyerEmail: string;
  userId: string;
  planType?: PlanType;
};

export type PdfWorkerResponse =
  | { id: string; ok: true; pdfBytes: ArrayBuffer }
  | { id: string; ok: false; code: string; message: string };

self.addEventListener("message", async (ev: MessageEvent<PdfWorkerRequest>) => {
  const data = ev.data;
  if (!data || data.type !== "protect") return;

  const { id, pdfBytes, buyerEmail, userId, planType } = data;
  try {
    const out = await applyCreatorGuardToPdfBytes(new Uint8Array(pdfBytes), {
      buyerEmail,
      userId,
      planType,
    });
    const buf = out.buffer.slice(
      out.byteOffset,
      out.byteOffset + out.byteLength
    ) as ArrayBuffer;
    const res: PdfWorkerResponse = { id, ok: true, pdfBytes: buf };
    self.postMessage(res, [buf]);
  } catch (e) {
    if (e instanceof CreatorGuardPdfCoreError) {
      const res: PdfWorkerResponse = {
        id,
        ok: false,
        code: e.code,
        message: e.message,
      };
      self.postMessage(res);
      return;
    }
    const msg = e instanceof Error ? e.message : "PDF processing failed.";
    const res: PdfWorkerResponse = {
      id,
      ok: false,
      code: "unknown",
      message: msg,
    };
    self.postMessage(res);
  }
});
