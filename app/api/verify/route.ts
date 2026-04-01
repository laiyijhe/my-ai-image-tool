import sharp from "sharp";
import {
  extractMemberIdDctDetailed,
  type BitShiftHex0to7,
  type WatermarkVerifyExtractDebug,
} from "@/lib/watermark-dct";
import { NextResponse } from "next/server";

// Deployment Sync: v1.0.4 — magic_missing debugSnapshot in 422 JSON; verify route cache bypass
export const dynamic = "force-dynamic";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/** Flat hex table: offset_0_hex-offset_1_hex-…-offset_7_hex (e.g. 00000000-43475703-…). */
function debugStringOffsets0to7(
  debug: WatermarkVerifyExtractDebug | null
): string {
  if (!debug?.bitShiftHex0to7 || typeof debug.bitShiftHex0to7 !== "object") {
    return "NO_OFFSET_DATA";
  }
  const row: BitShiftHex0to7 = debug.bitShiftHex0to7;
  const parts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const key = `offset_${i}_hex` as keyof BitShiftHex0to7;
    const v = row[key];
    parts.push(
      typeof v === "string" ? v : v == null ? "null" : String(v)
    );
  }
  return parts.join("-");
}

export async function POST(request: Request) {
  /** Always 200 — avoid browsers/devtools flagging JSON as a “failed” non-OK fetch. */
  const S = 200 as const;
  let lastKnownDebug: WatermarkVerifyExtractDebug | null = null;
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { ok: false, message: "VERIFY_NO_FILE" },
        { status: S }
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, message: "VERIFY_FILE_TOO_LARGE" },
        { status: S }
      );
    }

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    const { data, info } = await sharp(buf)
      .ensureAlpha()
      .toColorspace("srgb")
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels ?? 4;
    if (channels !== 4) {
      return NextResponse.json(
        { ok: false, message: "VERIFY_EXPECT_RGBA" },
        { status: S }
      );
    }

    const image = {
      bitmap: {
        data: Buffer.from(data),
        width: info.width,
        height: info.height,
      },
    };

    const result = extractMemberIdDctDetailed(image);

    if (result.ok) {
      return NextResponse.json(
        { ok: true, userId: result.userId },
        { status: S }
      );
    }

    lastKnownDebug = result.debug ?? null;

    if (result.code === "magic_missing") {
      const offs = result.debug?.bitShiftHex0to7 as
        | Record<string, unknown>
        | undefined;
      const v = offs?.["offset_1_hex"];
      const DIAGNOSTIC_HEX =
        v == null || v === "" ? "MISSING" : String(v);
      return NextResponse.json(
        {
          ok: false,
          code: "magic_missing",
          DIAGNOSTIC_HEX,
          FULL_OFFSETS: result.debug?.bitShiftHex0to7 ?? null,
          debugSnapshot: result.debugSnapshot,
        },
        { status: 422 }
      );
    }

    if (result.code === "utf8_corrupt" && result.debugSnapshot) {
      return NextResponse.json(
        {
          ok: false,
          code: "utf8_corrupt",
          debugSnapshot: result.debugSnapshot,
        },
        { status: S }
      );
    }

    return NextResponse.json(
      { ok: false, message: "FAIL: " + result.code },
      { status: S }
    );
  } catch (err) {
    console.error("[Creator Guard verify] POST crash:", err);
    return NextResponse.json(
      {
        ok: false,
        message: "CRASH_DIAGNOSTIC: " + debugStringOffsets0to7(lastKnownDebug),
      },
      { status: S }
    );
  }
}
