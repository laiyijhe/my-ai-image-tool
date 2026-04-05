import { PDFDocument } from "pdf-lib";

export async function sha256HexOfArrayBuffer(ab: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", ab);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function pdfPageCountFromArrayBuffer(
  ab: ArrayBuffer
): Promise<number> {
  try {
    const doc = await PDFDocument.load(ab, {
      ignoreEncryption: true,
    });
    return doc.getPageCount();
  } catch {
    return 0;
  }
}

export function formatFileSizeBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function makeForensicCaseId(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

export function formatEmbeddedUtc(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts || "—";
  return d.toISOString();
}
