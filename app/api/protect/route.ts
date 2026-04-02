import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { isAllowedProtectSourceUrl } from "@/lib/protect-source-url";
import {
  embedMemberIdDctInBitmap,
  WatermarkEmbedCapacityError,
} from "@/lib/watermark-dct";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export const runtime = "nodejs";

const MAX_REMOTE_IMAGE_BYTES = 25 * 1024 * 1024;

/**
 * 1:1 pipeline: no resize while **max(width,height) ≤** this (e.g. **~2000px** assets unchanged).
 */
const MAX_IMAGE_DIMENSION = 8192;

/**
 * Final encode is **lossless PNG** (no JPEG quality knob on this path). Input JPEGs are decoded at full fidelity by Sharp/libvips.
 * If you re-save the download as JPEG elsewhere, use **quality ≥ 95** and **4:4:4** chroma when your encoder supports it.
 */

/** Faster JPEG/TIFF decode; avoid random access when possible. */
const SHARP_DECODE_OPTIONS = { sequentialRead: true } as const;

const PUBLIC_REL = join("public", "test.jpg");

type EmbedIdSource = "memberId" | "userId" | "test_error_fallback" | "form_upload";

/**
 * Decode image to RGBA; downscale only if **max(w,h) > `MAX_IMAGE_DIMENSION`** (Sharp raw pipeline).
 * Sharp omits output metadata by default (no `keepMetadata()`); there is no `.strip()` chain — see Sharp docs.
 */
async function decodeResizeToRgba(
  input: Buffer
): Promise<{ data: Buffer; width: number; height: number }> {
  const meta = await sharp(input, SHARP_DECODE_OPTIONS).metadata();
  const w0 = meta.width ?? 0;
  const h0 = meta.height ?? 1;

  let pipeline = sharp(input, SHARP_DECODE_OPTIONS).ensureAlpha();

  const maxDim = Math.max(w0, h0);
  if (maxDim > MAX_IMAGE_DIMENSION) {
    const scale = MAX_IMAGE_DIMENSION / maxDim;
    const tw = Math.max(1, Math.round(w0 * scale));
    const th = Math.max(1, Math.round(h0 * scale));
    pipeline = pipeline.resize(tw, th, { fit: "fill" });
  }

  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });

  if (info.channels !== 4) {
    throw new Error("Expected RGBA from Sharp decode");
  }

  return {
    data: Buffer.from(data),
    width: info.width,
    height: info.height,
  };
}

async function loadDefaultImageBufferForRequest(
  request: NextRequest
): Promise<Buffer | null> {
  const localPath = join(process.cwd(), PUBLIC_REL);
  if (existsSync(localPath)) {
    try {
      return readFileSync(localPath);
    } catch {
      /* fall through */
    }
  }

  const url = new URL("/test.jpg", request.nextUrl.origin);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** When no query id is present — proves new protect route is live vs legacy `unknown` default. */
const FALLBACK_NO_ID = "TEST_ERROR_ID";

function pickSearchParam(request: NextRequest, key: string): string {
  const fromNext = request.nextUrl.searchParams.get(key);
  const fromFull = new URL(request.url).searchParams.get(key);
  const raw = (fromNext ?? fromFull ?? "").trim();
  return raw;
}

function resolveEmbeddedId(
  memberTrimmed: string,
  userTrimmed: string
): { embeddedId: string; idSource: EmbedIdSource } {
  if (memberTrimmed) {
    return { embeddedId: memberTrimmed, idSource: "memberId" };
  }
  if (userTrimmed) {
    return { embeddedId: userTrimmed, idSource: "userId" };
  }
  return { embeddedId: FALLBACK_NO_ID, idSource: "test_error_fallback" };
}

function safeDownloadBaseName(id: string): string {
  const s = id.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return (s.length > 0 ? s : "watermark").slice(0, 120);
}

async function respondProtectedImage(
  input: Buffer,
  embeddedId: string,
  idSource: EmbedIdSource,
  opts?: { forceDownload?: boolean }
): Promise<NextResponse> {
  try {
    const { data, width, height } = await decodeResizeToRgba(input);

    embedMemberIdDctInBitmap(data, width, height, embeddedId);

    const body = await sharp(data, {
      raw: { width, height, channels: 4 },
    })
      .png({
        compressionLevel: 9,
        adaptiveFiltering: false,
      })
      .toBuffer();

    const headers: Record<string, string> = {
      "Content-Type": "image/png",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
      "X-Creator-Guard-Embed-Source": idSource,
      "X-Creator-Guard-Version": "V5.2-GOLD",
    };
    if (opts?.forceDownload) {
      const baseName = safeDownloadBaseName(embeddedId);
      headers["Content-Disposition"] =
        `attachment; filename="creator-guard-${baseName}.png"`;
    }

    return new NextResponse(body as unknown as BodyInit, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("[Creator Guard protect] watermark failed:", err);
    if (err instanceof WatermarkEmbedCapacityError) {
      return NextResponse.json(
        {
          code: err.code,
          error: "capacity",
          message: "Not enough image area to embed this Member ID.",
          blocksNeeded: err.blocksNeeded,
          blocksHave: err.blocksHave,
        },
        { status: 422 }
      );
    }
    return NextResponse.json(
      {
        error: "Image processing failed",
        message: "Could not embed invisible watermark or encode image.",
      },
      { status: 500 }
    );
  }
}

function formUploadLooksLikeImage(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|avif|bmp|tiff?)$/i.test(file.name);
}

export async function POST(request: NextRequest) {
  throw new Error("STARK_V5_ACTIVE");
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid body", message: "Expected multipart/form-data." },
      { status: 400 }
    );
  }

  const memberTrimmed = String(formData.get("memberId") ?? "").trim();
  const userTrimmed =
    String(formData.get("userId") ?? "").trim() || "fallback_user";

  const fileField = formData.get("file");
  if (!fileField || !(fileField instanceof File)) {
    return NextResponse.json(
      { error: "Missing file", message: "Form field `file` must be an image." },
      { status: 400 }
    );
  }
  const file = fileField as File;

  if (!formUploadLooksLikeImage(file)) {
    return NextResponse.json(
      { error: "Invalid file", message: "Upload an image (JPEG, PNG, WebP, …)." },
      { status: 400 }
    );
  }

  if (file.size > MAX_REMOTE_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  let input: Buffer;
  try {
    input = Buffer.from(await file.arrayBuffer());
  } catch (err) {
    console.error("[Creator Guard protect] POST read failed:", err);
    return NextResponse.json(
      {
        error: "Decode failed",
        message: "Could not read that file as an image.",
      },
      { status: 400 }
    );
  }

  const { embeddedId, idSource: baseSource } = resolveEmbeddedId(
    memberTrimmed,
    userTrimmed
  );
  const idSource: EmbedIdSource =
    baseSource === "test_error_fallback" ? "form_upload" : baseSource;

  return respondProtectedImage(input, embeddedId, idSource, {
    forceDownload: true,
  });
}

export async function GET(request: NextRequest) {
  const memberTrimmed = pickSearchParam(request, "memberId");
  const userTrimmed = pickSearchParam(request, "userId");
  const { embeddedId, idSource } = resolveEmbeddedId(
    memberTrimmed,
    userTrimmed
  );

  const imageUrlParam = pickSearchParam(request, "imageUrl");
  let input: Buffer | null = null;

  if (imageUrlParam) {
    const imageUrl = imageUrlParam;
    if (!isAllowedProtectSourceUrl(imageUrl)) {
      return NextResponse.json(
        { error: "Invalid imageUrl", message: "Source host is not allowed." },
        { status: 400 }
      );
    }
    try {
      const res = await fetch(imageUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: "Source fetch failed", message: `HTTP ${res.status}` },
          { status: 502 }
        );
      }
      const len = res.headers.get("content-length");
      if (len && Number(len) > MAX_REMOTE_IMAGE_BYTES) {
        return NextResponse.json(
          { error: "Image too large" },
          { status: 413 }
        );
      }
      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_REMOTE_IMAGE_BYTES) {
        return NextResponse.json(
          { error: "Image too large" },
          { status: 413 }
        );
      }
      input = Buffer.from(ab);
    } catch (err) {
      console.error("[Creator Guard protect] remote image failed:", err);
      return NextResponse.json(
        {
          error: "Image fetch failed",
          message: "Could not load image from imageUrl.",
        },
        { status: 502 }
      );
    }
  } else {
    input = await loadDefaultImageBufferForRequest(request);
  }

  if (!input) {
    return NextResponse.json(
      {
        error: "Image not found",
        message:
          "The protected image (public/test.jpg) is missing or unreachable. Add the file or contact support.",
      },
      { status: 404 }
    );
  }

  return respondProtectedImage(input, embeddedId, idSource);
}
