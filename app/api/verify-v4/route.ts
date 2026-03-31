import { Jimp } from "jimp";
import {
  extractMemberIdDctDetailed,
  type BitShiftHex0to7,
  type WatermarkVerifyExtractDebug,
} from "@/lib/watermark-dct";
import { NextResponse } from "next/server";

/**
 * Cache-bypass twin of /api/verify — same behavior, new path so deploys cannot
 * serve a stale function bundle for this URL.
 */
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
  console.log("--- API_HIT_START verify-v4 ---");
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
    const image = await Jimp.read(Buffer.from(ab));
    const result = extractMemberIdDctDetailed(image);

    if (result.ok) {
      return NextResponse.json(
        { ok: true, userId: result.userId },
        { status: S }
      );
    }

    lastKnownDebug = result.debug ?? null;

    if (result.code === "magic_missing") {
      console.log(
        "--- RAW BITSCAN verify-v4 ---",
        result.debug?.bitShiftHex0to7
      );
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
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { ok: false, message: "FAIL: " + result.code },
      { status: S }
    );
  } catch (err) {
    console.error("[Creator Guard verify-v4] POST crash:", err);
    return NextResponse.json(
      {
        ok: false,
        message: "CRASH_DIAGNOSTIC: " + debugStringOffsets0to7(lastKnownDebug),
      },
      { status: S }
    );
  }
}
