import { Buffer } from "node:buffer";
import {
  CreatorGuardPdfError,
  isLikelyPdfBuffer,
  protectPdfWithCreatorGuard,
} from "@/lib/pdf-guard";
import { parseOptionalPlanType } from "@/lib/plan-types";
import { PDF_PROTECT_MAX_BYTES, safePdfFileName } from "@/lib/pdf-protect-shared";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid body", message: "Expected multipart/form-data." },
      { status: 400 }
    );
  }

  const buyerEmail = String(formData.get("buyerEmail") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  const planType = parseOptionalPlanType(formData.get("planType"));
  const file = formData.get("file");

  if (!buyerEmail) {
    return NextResponse.json(
      {
        error: "Missing buyerEmail",
        message: "Provide member identity in the `buyerEmail` field (1–64 characters).",
      },
      { status: 400 }
    );
  }

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing file", message: "Form field `file` must be a PDF." },
      { status: 400 }
    );
  }

  if (file.size > PDF_PROTECT_MAX_BYTES) {
    return NextResponse.json({ error: "PDF too large" }, { status: 413 });
  }

  if (
    file.type &&
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    return NextResponse.json(
      { error: "Invalid file", message: "Upload a PDF file." },
      { status: 400 }
    );
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json(
      { error: "Read failed", message: "Could not read the uploaded PDF." },
      { status: 400 }
    );
  }

  if (!isLikelyPdfBuffer(buf)) {
    return NextResponse.json(
      { error: "Not a PDF", message: "File does not look like a valid PDF." },
      { status: 415 }
    );
  }

  try {
    const out = await protectPdfWithCreatorGuard(buf, {
      buyerEmail,
      userId: userId || undefined,
      planType,
    });
    const body = Buffer.from(out);

    return new NextResponse(body as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
        "Content-Disposition": `attachment; filename="${safePdfFileName(file.name)}"`,
        "X-Creator-Guard-Mode": "PDF-V1.0-STABLE",
      },
    });
  } catch (e) {
    if (e instanceof CreatorGuardPdfError) {
      const status =
        e.code === "encrypted_pdf"
          ? 422
          : e.code === "invalid_email" || e.code === "invalid_member_identity"
            ? 400
            : 400;
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status }
      );
    }
    console.error("[Creator Guard PDF]", e);
    return NextResponse.json(
      {
        error: "pdf_failed",
        message: "Could not process this PDF. It may be corrupted or unsupported.",
      },
      { status: 500 }
    );
  }
}
