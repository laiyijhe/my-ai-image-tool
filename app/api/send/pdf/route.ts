import { Buffer } from "node:buffer";
import { ProtectedDocEmail } from "@/components/emails/ProtectedDocEmail";
import { PDF_PROTECT_MAX_BYTES } from "@/lib/pdf-protect-shared";
import { type NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { Resend } from "resend";

export const maxDuration = 60;
export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeAttachmentName(name: string): string {
  const n = name.trim() || "document.pdf";
  const withExt = n.toLowerCase().endsWith(".pdf") ? n : `${n}.pdf`;
  const safe = withExt.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return safe || "protected.pdf";
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "not_configured",
        message: "RESEND_API_KEY is not set. Add it to .env.local.",
      },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "Expected multipart/form-data." },
      { status: 400 }
    );
  }

  const to = String(formData.get("to") ?? "").trim();
  const file = formData.get("file");

  if (!to || !EMAIL_RE.test(to)) {
    return NextResponse.json(
      { error: "invalid_to", message: "Provide a valid recipient email." },
      { status: 400 }
    );
  }

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "missing_file", message: "Attach the PDF as form field `file`." },
      { status: 400 }
    );
  }

  if (file.size > PDF_PROTECT_MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", message: "PDF exceeds size limit." },
      { status: 413 }
    );
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json(
      { error: "read_failed", message: "Could not read the PDF." },
      { status: 400 }
    );
  }

  if (buf.length < 4 || buf.subarray(0, 4).toString("latin1") !== "%PDF") {
    return NextResponse.json(
      { error: "not_pdf", message: "Attachment must be a PDF." },
      { status: 415 }
    );
  }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Creator Guard <onboarding@resend.dev>";
  const attachmentName = safeAttachmentName(file.name);

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: "Your protected PDF from Creator Guard",
    react: createElement(ProtectedDocEmail, {
      recipientEmail: to,
      attachmentFileName: attachmentName,
    }),
    attachments: [
      {
        filename: attachmentName,
        content: buf,
        contentType: "application/pdf",
      },
    ],
  });

  if (error) {
    console.error("[send/pdf] Resend:", error);
    return NextResponse.json(
      {
        error: "resend_failed",
        message: error.message ?? "Could not send email.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
