import { PDF_PROTECT_MAX_BYTES } from "@/lib/pdf-protect-shared";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function contentTypeFor(name: string, declared: string | undefined): string {
  const ext = extOf(name);
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".zip") return "application/zip";
  if (declared && declared !== "application/octet-stream") return declared;
  return "application/octet-stream";
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return NextResponse.json(
      { error: "blob_not_configured" },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }

  if (file.size > PDF_PROTECT_MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const rawName =
    file instanceof File && file.name?.trim() ? file.name.trim() : "file.bin";
  const ext = extOf(rawName);
  if (ext !== ".pdf" && ext !== ".zip") {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }

  const safe = rawName.replace(/[^\w.\-()+]/g, "_").slice(0, 120);
  const pathname = `creator-guard/share-pdf/${Date.now()}-${safe}`;
  const contentType = contentTypeFor(
    rawName,
    file.type && file.type.length > 0 ? file.type : undefined
  );

  try {
    const blob = await put(pathname, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType,
      cacheControlMaxAge: 86400,
    });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("[share/pdf-upload] failed:", err);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
}
