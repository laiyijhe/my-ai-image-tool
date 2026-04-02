import { Buffer } from "node:buffer";
import { extractPdfFingerprint } from "@/lib/pdf-fingerprint";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const runtime = "nodejs";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

function isPdfMagic(buf: Buffer): boolean {
  return buf.length >= 4 && buf.subarray(0, 4).toString("latin1") === "%PDF";
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "Expected multipart/form-data." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "missing_file", message: "Form field `file` must be a PDF." },
      { status: 400 }
    );
  }

  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "too_large", message: "PDF too large." }, {
      status: 413,
    });
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json(
      { error: "read_failed", message: "Could not read upload." },
      { status: 400 }
    );
  }

  if (!isPdfMagic(buf)) {
    return NextResponse.json(
      { error: "not_pdf", message: "File does not look like a PDF." },
      { status: 415 }
    );
  }

  try {
    const result = await extractPdfFingerprint(new Uint8Array(buf));
    if (result.status === "found") {
      return NextResponse.json({
        status: "found",
        buyerEmail: result.buyerEmail,
        userId: result.userId,
        timestamp: result.timestamp,
        version: result.version,
        author: result.author ?? null,
        producer: result.producer ?? null,
      });
    }
    return NextResponse.json({
      status: "not_found",
      message: result.message,
      author: result.author ?? null,
      producer: result.producer ?? null,
    });
  } catch (e) {
    console.error("[verify/pdf]", e);
    return NextResponse.json(
      {
        error: "scan_failed",
        message: "Fingerprint scan failed.",
      },
      { status: 500 }
    );
  }
}
