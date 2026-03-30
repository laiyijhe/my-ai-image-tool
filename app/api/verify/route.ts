import { Jimp } from "jimp";
import {
  extractMemberIdDctDetailed,
  type WatermarkExtractFailureCode,
} from "@/lib/watermark-dct";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const DEBUG_MESSAGES: Record<WatermarkExtractFailureCode, string> = {
  magic_missing:
    "DCT watermark header missing — not from Creator Guard (v3), or the image was too heavily edited / scaled down.",
  unsupported_version:
    "Older LSB watermark (v1/v2). Download a fresh image from a protected link (v3 DCT).",
  length_invalid: "Data corrupted: invalid length field in payload.",
  payload_truncated: "Data corrupted: payload was cut off (truncated bit stream).",
  utf8_corrupt: "Data corrupted: Member ID bytes are not valid UTF-8.",
  capacity: "Image too small or too uniform to hold the frequency-domain watermark.",
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
    const result = extractMemberIdDctDetailed(image);

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
