import { Jimp } from "jimp";
import { extractMemberIdFromBitmap } from "@/lib/watermark-lsb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

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
    const userId = extractMemberIdFromBitmap(image);

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "no_watermark",
          message:
            "No Creator Guard watermark found. Use an original PNG from a protected link; JPEG recompression often removes invisible watermarks.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: true, userId });
  } catch (err) {
    console.error("[Creator Guard verify] decode failed:", err);
    return NextResponse.json(
      { ok: false, error: "decode_failed" },
      { status: 500 }
    );
  }
}
