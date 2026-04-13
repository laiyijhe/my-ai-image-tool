import { Buffer } from "node:buffer";
import {
  CreatorGuardPdfError,
  isLikelyPdfBuffer,
  protectPdfWithCreatorGuard,
} from "@/lib/pdf-guard";
import { parseOptionalPlanType } from "@/lib/plan-types";
import {
  PDF_BATCH_MAX_COMBOS,
  PDF_BATCH_MAX_MEMBER_IDENTITIES,
  PDF_BATCH_MAX_FILES,
  PDF_PROTECT_MAX_BYTES,
  parseEmailListFromRaw,
  protectedPdfZipEntryName,
} from "@/lib/pdf-protect-shared";
import JSZip from "jszip";
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

  const rawEmails = String(formData.get("emails") ?? "");
  const emails = parseEmailListFromRaw(rawEmails);
  const planType = parseOptionalPlanType(formData.get("planType"));

  const fileEntries = formData.getAll("files");
  const files = fileEntries.filter((x): x is File => x instanceof File);

  if (files.length === 0) {
    return NextResponse.json(
      {
        error: "Missing files",
        message: "Attach at least one PDF (field name `files`).",
      },
      { status: 400 }
    );
  }

  if (emails.length === 0) {
    return NextResponse.json(
      {
        error: "Missing member identities",
        message:
          "Provide at least one member identity in the `emails` field (comma / newline separated, 1–64 chars each).",
      },
      { status: 400 }
    );
  }

  if (files.length > PDF_BATCH_MAX_FILES) {
    return NextResponse.json(
      {
        error: "Too many files",
        message: `Maximum ${PDF_BATCH_MAX_FILES} PDFs per batch request.`,
      },
      { status: 400 }
    );
  }

  if (emails.length > PDF_BATCH_MAX_MEMBER_IDENTITIES) {
    return NextResponse.json(
      {
        error: "Too many identities",
        message: `Maximum ${PDF_BATCH_MAX_MEMBER_IDENTITIES} distinct member identities per batch.`,
      },
      { status: 400 }
    );
  }

  const combos = files.length * emails.length;
  if (combos > PDF_BATCH_MAX_COMBOS) {
    return NextResponse.json(
      {
        error: "Batch too large",
        message: `Too many combinations (${combos}). Max ${PDF_BATCH_MAX_COMBOS} (files × identities). Use the dashboard batch loop or split the job.`,
      },
      { status: 400 }
    );
  }

  for (const file of files) {
    if (file.size > PDF_PROTECT_MAX_BYTES) {
      return NextResponse.json(
        { error: "PDF too large", message: `Each PDF must be ≤ ${PDF_PROTECT_MAX_BYTES / (1024 * 1024)} MB.` },
        { status: 413 }
      );
    }
    if (
      file.type &&
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { error: "Invalid file", message: "All uploads must be PDF files." },
        { status: 400 }
      );
    }
  }

  const zip = new JSZip();
  let outIndex = 0;

  try {
    for (const file of files) {
      let buf: Buffer;
      try {
        buf = Buffer.from(await file.arrayBuffer());
      } catch {
        return NextResponse.json(
          { error: "Read failed", message: `Could not read: ${file.name}` },
          { status: 400 }
        );
      }

      if (!isLikelyPdfBuffer(buf)) {
        return NextResponse.json(
          {
            error: "Not a PDF",
            message: `File does not look like a valid PDF: ${file.name}`,
          },
          { status: 415 }
        );
      }

      for (const buyerEmail of emails) {
        const out = await protectPdfWithCreatorGuard(buf, {
          buyerEmail,
          planType,
        });
        const name = protectedPdfZipEntryName(file.name, buyerEmail, outIndex);
        zip.file(name, Buffer.from(out));
        outIndex += 1;
      }
    }

    const zipped = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    return new NextResponse(new Uint8Array(zipped), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
        "Content-Disposition": 'attachment; filename="creator-guard-batch.zip"',
        "X-Creator-Guard-Mode": "PDF-BATCH-V2",
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
    console.error("[Creator Guard PDF batch]", e);
    return NextResponse.json(
      {
        error: "batch_failed",
        message: "Batch processing failed. One or more PDFs may be unsupported.",
      },
      { status: 500 }
    );
  }
}
