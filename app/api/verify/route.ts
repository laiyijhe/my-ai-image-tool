import { Jimp } from "jimp";
import {
  extractMemberIdFromBitmapDetailed,
  type WatermarkExtractFailureCode,
} from "@/lib/watermark-lsb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const DEBUG_MESSAGES: Record<WatermarkExtractFailureCode, string> = {
  magic_missing:
    "Magic header missing — not a Creator Guard v2 image, or pixels were altered / recompressed.",
  unsupported_version:
    "Unsupported watermark version (expected v2 / 2-bit blue). Re-export a fresh PNG from a protected link.",
  length_invalid: "Data corrupted: invalid length field in payload.",
  payload_truncated: "Data corrupted: payload was cut off (truncated bit stream).",
  utf8_corrupt: "Data corrupted: Member ID bytes are not valid UTF-8.",
};

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_form" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { ok: false, error: "no_file" },
      { status: 400 }
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: "file_too_large" },
      { status: 413 }
    );
  }

  try {
    const ab = await file.arrayBuffer();
    const image = await Jimp.read(Buffer.from(ab));
    const result = extractMemberIdFromBitmapDetailed(image);

    if (result.ok) {
      return NextResponse.json({ ok: true, userId: result.userId });
    }

    const code = result.code;
    return NextResponse.json(
      {
        ok: false,
        error: "watermark_failed",
        code,
        message: DEBUG_MESSAGES[code],
      },
      { status: 422 }
    );
  } catch (err) {
    console.error("[Creator Guard verify] decode failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "decode_failed",
        code: "decode_failed",
        message: "Server could not decode the image file.",
      },
      { status: 500 }
    );
  }
}
